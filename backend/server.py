from dotenv import load_dotenv
from pathlib import Path

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

import os
import io
import base64
import logging
import bcrypt
import jwt
from datetime import datetime, timezone, timedelta, date
from typing import List, Optional
from bson import ObjectId
from fastapi import FastAPI, APIRouter, HTTPException, Depends, Request
from fastapi.responses import Response
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
from pydantic import BaseModel, Field, EmailStr, field_validator
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib import colors
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle
from reportlab.lib.units import cm

# --------- Setup ---------
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

JWT_SECRET = os.environ['JWT_SECRET']
JWT_ALGO = "HS256"

app = FastAPI()
api = APIRouter(prefix="/api")

logging.basicConfig(level=logging.INFO)
log = logging.getLogger(__name__)

# --------- Romania Public Holidays 2025-2026 ---------
RO_HOLIDAYS = {
    # 2025
    "2025-01-01", "2025-01-02", "2025-01-06", "2025-01-07", "2025-01-24",
    "2025-04-18", "2025-04-20", "2025-04-21", "2025-05-01",
    "2025-06-01", "2025-06-08", "2025-06-09", "2025-08-15",
    "2025-11-30", "2025-12-01", "2025-12-25", "2025-12-26",
    # 2026
    "2026-01-01", "2026-01-02", "2026-01-06", "2026-01-07", "2026-01-24",
    "2026-04-10", "2026-04-12", "2026-04-13", "2026-05-01",
    "2026-05-31", "2026-06-01", "2026-08-15",
    "2026-11-30", "2026-12-01", "2026-12-25", "2026-12-26",
}


def calc_working_days(start: date, end: date) -> int:
    if end < start:
        return 0
    days = 0
    cur = start
    while cur <= end:
        if cur.weekday() < 5 and cur.isoformat() not in RO_HOLIDAYS:
            days += 1
        cur += timedelta(days=1)
    return days


# --------- Helpers ---------
def hash_password(p: str) -> str:
    return bcrypt.hashpw(p.encode(), bcrypt.gensalt()).decode()


def verify_password(p: str, h: str) -> bool:
    try:
        return bcrypt.checkpw(p.encode(), h.encode())
    except Exception:
        return False


def create_token(uid: str, email: str, role: str) -> str:
    return jwt.encode(
        {"sub": uid, "email": email, "role": role,
         "exp": datetime.now(timezone.utc) + timedelta(days=7)},
        JWT_SECRET, algorithm=JWT_ALGO)


def oid(x: str) -> ObjectId:
    try:
        return ObjectId(x)
    except Exception:
        raise HTTPException(400, "ID invalid")


def ser(doc):
    if not doc:
        return doc
    doc["id"] = str(doc.pop("_id"))
    for k, v in list(doc.items()):
        if isinstance(v, ObjectId):
            doc[k] = str(v)
    return doc


async def get_user(request: Request) -> dict:
    auth = request.headers.get("Authorization", "")
    if not auth.startswith("Bearer "):
        raise HTTPException(401, "Neautentificat")
    try:
        p = jwt.decode(auth[7:], JWT_SECRET, algorithms=[JWT_ALGO])
    except jwt.ExpiredSignatureError:
        raise HTTPException(401, "Sesiune expirată")
    except jwt.InvalidTokenError:
        raise HTTPException(401, "Token invalid")
    u = await db.users.find_one({"_id": ObjectId(p["sub"])})
    if not u:
        raise HTTPException(401, "Utilizator inexistent")
    u = ser(u)
    u.pop("password_hash", None)
    return u


def require_role(*roles):
    async def _check(user=Depends(get_user)):
        if user["role"] not in roles:
            raise HTTPException(403, "Acces interzis pentru rolul curent")
        return user
    return _check


# --------- Models ---------
class LoginIn(BaseModel):
    email: EmailStr
    password: str


class UserIn(BaseModel):
    name: str = Field(min_length=1, max_length=80)
    email: EmailStr
    password: Optional[str] = Field(default=None, min_length=6)
    role: str
    dept_id: Optional[str] = None
    annual_leave_days: int = Field(default=21, ge=0, le=60)

    @field_validator("role")
    @classmethod
    def v_role(cls, v):
        if v not in ("USER", "DEPT_RESP", "ADMIN"):
            raise ValueError("Rol invalid")
        return v


class DepartmentIn(BaseModel):
    department_name: str = Field(min_length=1, max_length=80)
    manager_id: Optional[str] = None
    max_absent_employees: int = Field(ge=1, le=100)


class LeaveTypeIn(BaseModel):
    name: str = Field(min_length=1, max_length=80)
    code: str = Field(min_length=1, max_length=20)
    requires_attachment: bool = False
    paid: bool = True


class LeaveRequestIn(BaseModel):
    leave_type_id: str
    start_date: str  # YYYY-MM-DD
    end_date: str
    attachment: Optional[dict] = None  # {file_name, content_base64}
    submit: bool = True  # True = PENDING, False = DRAFT


class LeaveActionIn(BaseModel):
    action: str  # APPROVE / REJECT / CANCEL / SUBMIT
    comment: Optional[str] = None


# --------- Auth ---------
@api.post("/auth/login")
async def login(body: LoginIn):
    email = body.email.lower()
    u = await db.users.find_one({"email": email})
    if not u or not verify_password(body.password, u["password_hash"]):
        raise HTTPException(401, "Email sau parolă incorecte")
    token = create_token(str(u["_id"]), email, u["role"])
    return {
        "token": token,
        "user": {
            "id": str(u["_id"]), "email": email, "name": u["name"], "role": u["role"],
            "dept_id": str(u.get("dept_id")) if u.get("dept_id") else None,
            "annual_leave_days": u.get("annual_leave_days", 0),
            "available_leave_days": u.get("available_leave_days", 0),
        },
    }


@api.get("/auth/me")
async def me(user=Depends(get_user)):
    if user.get("dept_id"):
        d = await db.departments.find_one({"_id": oid(user["dept_id"])})
        user["department"] = ser(d) if d else None
    return user


# --------- Departments ---------
@api.get("/departments")
async def list_departments(user=Depends(get_user)):
    docs = await db.departments.find({}).sort("department_name", 1).to_list(500)
    out = []
    for d in docs:
        d = ser(d)
        if d.get("manager_id"):
            m = await db.users.find_one({"_id": oid(d["manager_id"])})
            d["manager_name"] = m["name"] if m else None
        d["employee_count"] = await db.users.count_documents({"dept_id": oid(d["id"])})
        out.append(d)
    return out


@api.post("/departments")
async def create_department(body: DepartmentIn, user=Depends(require_role("ADMIN"))):
    doc = body.model_dump()
    if doc.get("manager_id"):
        doc["manager_id"] = oid(doc["manager_id"])
    res = await db.departments.insert_one(doc)
    return ser(await db.departments.find_one({"_id": res.inserted_id}))


@api.put("/departments/{did}")
async def update_department(did: str, body: DepartmentIn, user=Depends(require_role("ADMIN"))):
    doc = body.model_dump()
    doc["manager_id"] = oid(doc["manager_id"]) if doc.get("manager_id") else None
    await db.departments.update_one({"_id": oid(did)}, {"$set": doc})
    return ser(await db.departments.find_one({"_id": oid(did)}))


@api.delete("/departments/{did}")
async def del_department(did: str, user=Depends(require_role("ADMIN"))):
    if await db.users.find_one({"dept_id": oid(did)}):
        raise HTTPException(400, "Există angajați asociați acestui departament")
    r = await db.departments.delete_one({"_id": oid(did)})
    if r.deleted_count == 0:
        raise HTTPException(404, "Departament inexistent")
    return {"ok": True}


# --------- Users (Admin) ---------
@api.get("/users")
async def list_users(dept_id: Optional[str] = None, user=Depends(get_user)):
    filt = {}
    if dept_id:
        filt["dept_id"] = oid(dept_id)
    docs = await db.users.find(filt).sort("name", 1).to_list(500)
    out = []
    for d in docs:
        d = ser(d)
        d.pop("password_hash", None)
        if d.get("dept_id"):
            dep = await db.departments.find_one({"_id": oid(d["dept_id"])})
            d["department_name"] = dep["department_name"] if dep else None
        out.append(d)
    return out


@api.post("/users")
async def create_user(body: UserIn, user=Depends(require_role("ADMIN"))):
    email = body.email.lower()
    if await db.users.find_one({"email": email}):
        raise HTTPException(400, "Există deja un utilizator cu acest email")
    doc = body.model_dump()
    doc["email"] = email
    pwd = doc.pop("password") or "parola123"
    doc["password_hash"] = hash_password(pwd)
    doc["available_leave_days"] = doc["annual_leave_days"]
    if doc.get("dept_id"):
        doc["dept_id"] = oid(doc["dept_id"])
    res = await db.users.insert_one(doc)
    return ser(await db.users.find_one({"_id": res.inserted_id}))


@api.put("/users/{uid}")
async def update_user(uid: str, body: UserIn, user=Depends(require_role("ADMIN"))):
    doc = body.model_dump()
    doc["email"] = doc["email"].lower()
    pwd = doc.pop("password", None)
    if pwd:
        doc["password_hash"] = hash_password(pwd)
    doc["dept_id"] = oid(doc["dept_id"]) if doc.get("dept_id") else None
    await db.users.update_one({"_id": oid(uid)}, {"$set": doc})
    return ser(await db.users.find_one({"_id": oid(uid)}))


@api.delete("/users/{uid}")
async def delete_user(uid: str, user=Depends(require_role("ADMIN"))):
    r = await db.users.delete_one({"_id": oid(uid)})
    if r.deleted_count == 0:
        raise HTTPException(404, "Utilizator inexistent")
    return {"ok": True}


# --------- Leave Types ---------
@api.get("/leave-types")
async def list_leave_types(user=Depends(get_user)):
    docs = await db.leave_types.find({}).sort("code", 1).to_list(100)
    return [ser(d) for d in docs]


@api.post("/leave-types")
async def create_leave_type(body: LeaveTypeIn, user=Depends(require_role("ADMIN"))):
    if await db.leave_types.find_one({"code": body.code.upper()}):
        raise HTTPException(400, "Există deja un tip de concediu cu acest cod")
    doc = body.model_dump()
    doc["code"] = doc["code"].upper()
    res = await db.leave_types.insert_one(doc)
    return ser(await db.leave_types.find_one({"_id": res.inserted_id}))


@api.put("/leave-types/{lid}")
async def update_leave_type(lid: str, body: LeaveTypeIn, user=Depends(require_role("ADMIN"))):
    doc = body.model_dump()
    doc["code"] = doc["code"].upper()
    await db.leave_types.update_one({"_id": oid(lid)}, {"$set": doc})
    return ser(await db.leave_types.find_one({"_id": oid(lid)}))


@api.delete("/leave-types/{lid}")
async def delete_leave_type(lid: str, user=Depends(require_role("ADMIN"))):
    if await db.leave_requests.find_one({"leave_type_id": oid(lid)}):
        raise HTTPException(400, "Există cereri asociate acestui tip")
    r = await db.leave_types.delete_one({"_id": oid(lid)})
    if r.deleted_count == 0:
        raise HTTPException(404, "Tip inexistent")
    return {"ok": True}


# --------- Leave Requests ---------
async def _enrich_request(r):
    r = ser(r)
    u = await db.users.find_one({"_id": oid(r["empl_id"])})
    r["employee_name"] = u["name"] if u else "?"
    r["employee_email"] = u["email"] if u else ""
    if u and u.get("dept_id"):
        dep = await db.departments.find_one({"_id": u["dept_id"]})
        r["department_name"] = dep["department_name"] if dep else None
        r["dept_id"] = str(u["dept_id"])
    lt = await db.leave_types.find_one({"_id": oid(r["leave_type_id"])})
    if lt:
        r["leave_type_name"] = lt["name"]
        r["leave_type_code"] = lt["code"]
        r["leave_type_paid"] = lt.get("paid", True)
    atts = await db.attachments.find({"leave_request_id": oid(r["id"])}, {"content_base64": 0}).to_list(20)
    r["attachments"] = [ser(a) for a in atts]
    return r


@api.get("/leave-requests")
async def list_leave_requests(
    scope: str = "self",  # self | department | all
    status: Optional[str] = None,
    user=Depends(get_user),
):
    filt = {}
    if scope == "self":
        filt["empl_id"] = oid(user["id"])
    elif scope == "department":
        if user["role"] not in ("DEPT_RESP", "ADMIN"):
            raise HTTPException(403, "Doar managerii pot vedea departamentul")
        if user["role"] == "DEPT_RESP" and user.get("dept_id"):
            dep_users = await db.users.find({"dept_id": oid(user["dept_id"])}).to_list(500)
            filt["empl_id"] = {"$in": [u["_id"] for u in dep_users]}
        elif user["role"] == "DEPT_RESP":
            filt["empl_id"] = oid(user["id"])
    elif scope == "all":
        if user["role"] != "ADMIN":
            raise HTTPException(403, "Doar administratorii pot vedea toate cererile")

    if status:
        filt["status"] = status
    docs = await db.leave_requests.find(filt).sort("created_at", -1).to_list(1000)
    return [await _enrich_request(d) for d in docs]


@api.get("/leave-requests/{rid}")
async def get_leave_request(rid: str, user=Depends(get_user)):
    r = await db.leave_requests.find_one({"_id": oid(rid)})
    if not r:
        raise HTTPException(404, "Cerere inexistentă")
    # ownership check
    if user["role"] == "USER" and str(r["empl_id"]) != user["id"]:
        raise HTTPException(403, "Nu aveți acces la această cerere")
    return await _enrich_request(r)


@api.get("/leave-requests/{rid}/workflow")
async def get_workflow(rid: str, user=Depends(get_user)):
    docs = await db.leave_workflow.find({"leave_request_id": oid(rid)}).sort("changed_at", 1).to_list(200)
    out = []
    for d in docs:
        d = ser(d)
        u = await db.users.find_one({"_id": oid(d["empl_id"])})
        d["user_name"] = u["name"] if u else "?"
        out.append(d)
    return out


async def _log_workflow(rid, empl_id, old, new, comment=None):
    await db.leave_workflow.insert_one({
        "leave_request_id": oid(rid),
        "empl_id": oid(empl_id),
        "old_status": old,
        "current_status": new,
        "comment": comment,
        "changed_at": datetime.now(timezone.utc).isoformat(),
    })


@api.post("/leave-requests")
async def create_leave_request(body: LeaveRequestIn, user=Depends(get_user)):
    try:
        sd = date.fromisoformat(body.start_date)
        ed = date.fromisoformat(body.end_date)
    except Exception:
        raise HTTPException(400, "Format dată invalid")
    if ed < sd:
        raise HTTPException(400, "Data de sfârșit este anterioară datei de început")

    lt = await db.leave_types.find_one({"_id": oid(body.leave_type_id)})
    if not lt:
        raise HTTPException(400, "Tip concediu inexistent")

    wd = calc_working_days(sd, ed)
    if wd <= 0:
        raise HTTPException(400, "Perioada nu conține zile lucrătoare")

    # Balance check for paid
    if lt.get("paid", True):
        u = await db.users.find_one({"_id": oid(user["id"])})
        if u.get("available_leave_days", 0) < wd:
            raise HTTPException(400, f"Sold insuficient: aveți {u.get('available_leave_days',0)} zile disponibile, cerere pentru {wd} zile")

    # Attachment
    att_doc = None
    if lt.get("requires_attachment") and body.submit:
        if not body.attachment or not body.attachment.get("content_base64"):
            raise HTTPException(400, "Este necesar un atașament pentru acest tip de concediu")

    status = "PENDING" if body.submit else "DRAFT"
    doc = {
        "empl_id": oid(user["id"]),
        "leave_type_id": oid(body.leave_type_id),
        "start_date": body.start_date,
        "end_date": body.end_date,
        "working_days": wd,
        "status": status,
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    res = await db.leave_requests.insert_one(doc)

    if body.attachment and body.attachment.get("content_base64"):
        c = body.attachment["content_base64"]
        # ~2MB base64 = ~2.6M chars
        if len(c) > 2_800_000:
            await db.leave_requests.delete_one({"_id": res.inserted_id})
            raise HTTPException(400, "Fișier prea mare (max 2MB)")
        await db.attachments.insert_one({
            "leave_request_id": res.inserted_id,
            "file_name": body.attachment.get("file_name", "atasament"),
            "content_base64": c,
            "uploaded_at": datetime.now(timezone.utc).isoformat(),
        })

    await _log_workflow(str(res.inserted_id), user["id"], "-", status)
    return await _enrich_request(await db.leave_requests.find_one({"_id": res.inserted_id}))


@api.put("/leave-requests/{rid}/action")
async def action_leave_request(rid: str, body: LeaveActionIn, user=Depends(get_user)):
    r = await db.leave_requests.find_one({"_id": oid(rid)})
    if not r:
        raise HTTPException(404, "Cerere inexistentă")

    old_status = r["status"]
    new_status = None
    action = body.action.upper()

    if action == "SUBMIT":  # DRAFT -> PENDING (by owner)
        if str(r["empl_id"]) != user["id"]:
            raise HTTPException(403, "Doar proprietarul poate trimite cererea")
        if old_status != "DRAFT":
            raise HTTPException(400, "Doar ciornele pot fi trimise")
        new_status = "PENDING"
    elif action == "CANCEL":
        if str(r["empl_id"]) != user["id"] and user["role"] != "ADMIN":
            raise HTTPException(403, "Doar proprietarul (sau admin) poate anula")
        if old_status not in ("DRAFT", "PENDING"):
            raise HTTPException(400, "Doar cererile ne-aprobate pot fi anulate")
        new_status = "CANCELLED"
    elif action == "APPROVE":
        if user["role"] not in ("DEPT_RESP", "ADMIN"):
            raise HTTPException(403, "Doar managerii pot aproba")
        if old_status != "PENDING":
            raise HTTPException(400, "Doar cererile în așteptare pot fi aprobate")
        # Ensure manager owns the department (unless ADMIN)
        emp = await db.users.find_one({"_id": r["empl_id"]})
        if user["role"] == "DEPT_RESP" and emp and str(emp.get("dept_id")) != user.get("dept_id"):
            raise HTTPException(403, "Angajatul nu este din departamentul dvs.")
        # Deduct balance if paid
        lt = await db.leave_types.find_one({"_id": r["leave_type_id"]})
        if lt and lt.get("paid", True):
            u2 = await db.users.find_one({"_id": r["empl_id"]})
            if u2.get("available_leave_days", 0) < r["working_days"]:
                raise HTTPException(400, "Sold insuficient pentru angajat")
            await db.users.update_one({"_id": r["empl_id"]}, {"$inc": {"available_leave_days": -r["working_days"]}})
        new_status = "APPROVED"
    elif action == "REJECT":
        if user["role"] not in ("DEPT_RESP", "ADMIN"):
            raise HTTPException(403, "Doar managerii pot respinge")
        if old_status != "PENDING":
            raise HTTPException(400, "Doar cererile în așteptare pot fi respinse")
        if not body.comment or not body.comment.strip():
            raise HTTPException(400, "Un motiv de respingere este obligatoriu")
        new_status = "REJECTED"
    else:
        raise HTTPException(400, "Acțiune invalidă")

    await db.leave_requests.update_one({"_id": oid(rid)}, {"$set": {"status": new_status}})
    await _log_workflow(rid, user["id"], old_status, new_status, body.comment)
    return await _enrich_request(await db.leave_requests.find_one({"_id": oid(rid)}))


@api.delete("/leave-requests/{rid}")
async def delete_leave_request(rid: str, user=Depends(require_role("ADMIN"))):
    r = await db.leave_requests.find_one({"_id": oid(rid)})
    if not r:
        raise HTTPException(404, "Cerere inexistentă")
    if r["status"] == "APPROVED":
        lt = await db.leave_types.find_one({"_id": r["leave_type_id"]})
        if lt and lt.get("paid", True):
            await db.users.update_one({"_id": r["empl_id"]}, {"$inc": {"available_leave_days": r["working_days"]}})
    await db.attachments.delete_many({"leave_request_id": oid(rid)})
    await db.leave_workflow.delete_many({"leave_request_id": oid(rid)})
    await db.leave_requests.delete_one({"_id": oid(rid)})
    return {"ok": True}


# --------- Attachments ---------
@api.get("/attachments/{aid}")
async def get_attachment(aid: str, user=Depends(get_user)):
    a = await db.attachments.find_one({"_id": oid(aid)})
    if not a:
        raise HTTPException(404, "Atașament inexistent")
    return {"id": str(a["_id"]), "file_name": a["file_name"], "content_base64": a["content_base64"]}


# --------- Working Days Preview ---------
@api.get("/leave-requests/preview/working-days")
async def preview_working_days(start_date: str, end_date: str, user=Depends(get_user)):
    try:
        sd = date.fromisoformat(start_date)
        ed = date.fromisoformat(end_date)
    except Exception:
        raise HTTPException(400, "Format dată invalid")
    return {"working_days": calc_working_days(sd, ed)}


# --------- Calendar (approved requests) ---------
@api.get("/calendar")
async def calendar(start: str, end: str, dept_id: Optional[str] = None, user=Depends(get_user)):
    try:
        _sd = date.fromisoformat(start)
        _ed = date.fromisoformat(end)
    except Exception:
        raise HTTPException(400, "Date invalide")
    filt = {"status": {"$in": ["APPROVED", "PENDING"]},
            "start_date": {"$lte": end}, "end_date": {"$gte": start}}
    # scope
    if user["role"] == "USER":
        # only own dept approved
        if user.get("dept_id"):
            dep_users = await db.users.find({"dept_id": oid(user["dept_id"])}).to_list(500)
            filt["empl_id"] = {"$in": [u["_id"] for u in dep_users]}
    elif user["role"] == "DEPT_RESP":
        if user.get("dept_id"):
            dep_users = await db.users.find({"dept_id": oid(user["dept_id"])}).to_list(500)
            filt["empl_id"] = {"$in": [u["_id"] for u in dep_users]}
    elif user["role"] == "ADMIN" and dept_id:
        dep_users = await db.users.find({"dept_id": oid(dept_id)}).to_list(500)
        filt["empl_id"] = {"$in": [u["_id"] for u in dep_users]}
    docs = await db.leave_requests.find(filt).to_list(500)
    return [await _enrich_request(d) for d in docs]


# --------- Reports / Dashboard ---------
@api.get("/dashboard")
async def dashboard(user=Depends(get_user)):
    role = user["role"]
    result = {"role": role}

    if role == "USER":
        u = await db.users.find_one({"_id": oid(user["id"])})
        result["balance"] = {
            "annual": u.get("annual_leave_days", 0),
            "available": u.get("available_leave_days", 0),
            "consumed": u.get("annual_leave_days", 0) - u.get("available_leave_days", 0),
        }
        pipeline = [{"$match": {"empl_id": oid(user["id"])}},
                    {"$group": {"_id": "$status", "count": {"$sum": 1}}}]
        by_status = await db.leave_requests.aggregate(pipeline).to_list(50)
        result["by_status"] = [{"status": r["_id"], "count": r["count"]} for r in by_status]
        recent = await db.leave_requests.find({"empl_id": oid(user["id"])}).sort("created_at", -1).limit(5).to_list(5)
        result["recent"] = [await _enrich_request(r) for r in recent]

    elif role == "DEPT_RESP":
        dep_users = await db.users.find({"dept_id": oid(user["dept_id"])}).to_list(500) if user.get("dept_id") else []
        emp_ids = [u["_id"] for u in dep_users]
        pending = await db.leave_requests.count_documents({"empl_id": {"$in": emp_ids}, "status": "PENDING"})
        approved = await db.leave_requests.count_documents({"empl_id": {"$in": emp_ids}, "status": "APPROVED"})
        today = date.today().isoformat()
        absent_today = await db.leave_requests.count_documents({
            "empl_id": {"$in": emp_ids}, "status": "APPROVED",
            "start_date": {"$lte": today}, "end_date": {"$gte": today}
        })
        dept = await db.departments.find_one({"_id": oid(user["dept_id"])}) if user.get("dept_id") else None
        result["kpi"] = {
            "team_size": len(dep_users),
            "pending": pending,
            "approved": approved,
            "absent_today": absent_today,
            "max_absent": dept.get("max_absent_employees") if dept else None,
        }
        pending_docs = await db.leave_requests.find({"empl_id": {"$in": emp_ids}, "status": "PENDING"}).sort("created_at", -1).limit(10).to_list(10)
        result["pending_list"] = [await _enrich_request(r) for r in pending_docs]

    elif role == "ADMIN":
        total_users = await db.users.count_documents({})
        total_pending = await db.leave_requests.count_documents({"status": "PENDING"})
        total_approved = await db.leave_requests.count_documents({"status": "APPROVED"})
        total_depts = await db.departments.count_documents({})
        result["kpi"] = {
            "total_users": total_users,
            "total_departments": total_depts,
            "pending": total_pending,
            "approved": total_approved,
        }
        # per department
        depts = await db.departments.find({}).to_list(100)
        per_dept = []
        for d in depts:
            dep_users = await db.users.find({"dept_id": d["_id"]}).to_list(500)
            emp_ids = [u["_id"] for u in dep_users]
            p = await db.leave_requests.count_documents({"empl_id": {"$in": emp_ids}, "status": "PENDING"})
            a = await db.leave_requests.count_documents({"empl_id": {"$in": emp_ids}, "status": "APPROVED"})
            per_dept.append({
                "department": d["department_name"],
                "employees": len(dep_users),
                "pending": p,
                "approved": a,
            })
        result["per_department"] = per_dept

        # per leave type
        pipeline = [{"$match": {"status": "APPROVED"}},
                    {"$group": {"_id": "$leave_type_id", "total_days": {"$sum": "$working_days"}, "count": {"$sum": 1}}}]
        agg = await db.leave_requests.aggregate(pipeline).to_list(50)
        per_type = []
        for r in agg:
            lt = await db.leave_types.find_one({"_id": r["_id"]})
            per_type.append({"code": lt["code"] if lt else "?", "name": lt["name"] if lt else "?",
                             "total_days": r["total_days"], "count": r["count"]})
        result["per_leave_type"] = per_type

    return result


# --------- PDF Export ---------
@api.get("/leave-requests/{rid}/pdf")
async def export_pdf(rid: str, user=Depends(get_user)):
    r = await db.leave_requests.find_one({"_id": oid(rid)})
    if not r:
        raise HTTPException(404, "Cerere inexistentă")
    if user["role"] == "USER" and str(r["empl_id"]) != user["id"]:
        raise HTTPException(403, "Fără acces")
    if r["status"] != "APPROVED":
        raise HTTPException(400, "PDF disponibil doar pentru cereri aprobate")

    enr = await _enrich_request(r)
    buf = io.BytesIO()
    doc = SimpleDocTemplate(buf, pagesize=A4, topMargin=2 * cm, bottomMargin=2 * cm)
    styles = getSampleStyleSheet()
    title_style = ParagraphStyle('t', parent=styles['Title'], fontSize=16, textColor=colors.HexColor("#0f172a"))
    h_style = ParagraphStyle('h', parent=styles['Normal'], fontSize=10, textColor=colors.HexColor("#64748b"))
    body = []
    body.append(Paragraph("DRAXLMAIER — Employee Leave Hub", title_style))
    body.append(Paragraph("Cerere de concediu aprobată", h_style))
    body.append(Spacer(1, 0.7 * cm))
    tbl_data = [
        ["Angajat", enr["employee_name"]],
        ["Email", enr["employee_email"]],
        ["Departament", enr.get("department_name") or "-"],
        ["Tip concediu", f"{enr.get('leave_type_name')} ({enr.get('leave_type_code')})"],
        ["Dată început", enr["start_date"]],
        ["Dată sfârșit", enr["end_date"]],
        ["Zile lucrătoare", str(enr["working_days"])],
        ["Status", enr["status"]],
        ["Creat la", enr["created_at"][:10]],
    ]
    t = Table(tbl_data, colWidths=[5 * cm, 11 * cm])
    t.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (0, -1), colors.HexColor("#f1f5f9")),
        ("TEXTCOLOR", (0, 0), (-1, -1), colors.HexColor("#0f172a")),
        ("FONTNAME", (0, 0), (-1, -1), "Helvetica"),
        ("FONTSIZE", (0, 0), (-1, -1), 10),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 8),
        ("TOPPADDING", (0, 0), (-1, -1), 8),
        ("GRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#e2e8f0")),
    ]))
    body.append(t)
    body.append(Spacer(1, 1 * cm))
    body.append(Paragraph("Această cerere a fost aprobată electronic în platforma DRAXLMAIER Employee Leave Hub.", h_style))
    body.append(Spacer(1, 2 * cm))
    body.append(Paragraph(f"Data emiterii documentului: {date.today().isoformat()}", h_style))
    doc.build(body)
    pdf = buf.getvalue()
    buf.close()
    return Response(content=pdf, media_type="application/pdf",
                    headers={"Content-Disposition": f'attachment; filename="cerere_{rid[:8]}.pdf"'})


# --------- Seed ---------
async def seed_admin():
    email = os.environ.get("ADMIN_EMAIL").lower()
    pwd = os.environ.get("ADMIN_PASSWORD")
    existing = await db.users.find_one({"email": email})
    if not existing:
        await db.users.insert_one({
            "email": email,
            "password_hash": hash_password(pwd),
            "name": "Administrator Sistem",
            "role": "ADMIN",
            "dept_id": None,
            "annual_leave_days": 25,
            "available_leave_days": 25,
        })
        log.info(f"Admin seeded: {email}")


async def seed_demo():
    if await db.leave_types.count_documents({}) > 0:
        return
    # Departments
    depts_data = [
        {"department_name": "IT", "max_absent_employees": 2},
        {"department_name": "HR", "max_absent_employees": 1},
        {"department_name": "Producție", "max_absent_employees": 3},
        {"department_name": "Logistică", "max_absent_employees": 2},
    ]
    d_res = await db.departments.insert_many(depts_data)
    d_ids = d_res.inserted_ids
    it_id, hr_id, prod_id, log_id = d_ids

    # Managers
    mgrs = [
        {"name": "Mihai Constantin", "email": "manager.it@draxlmaier.ro", "role": "DEPT_RESP", "dept_id": it_id},
        {"name": "Andreea Radu", "email": "manager.hr@draxlmaier.ro", "role": "DEPT_RESP", "dept_id": hr_id},
        {"name": "Cristian Munteanu", "email": "manager.prod@draxlmaier.ro", "role": "DEPT_RESP", "dept_id": prod_id},
    ]
    for m in mgrs:
        m["password_hash"] = hash_password("parola123")
        m["annual_leave_days"] = 25
        m["available_leave_days"] = 25
    m_res = await db.users.insert_many(mgrs)
    mit, mhr, mprod = m_res.inserted_ids

    # Update department managers
    await db.departments.update_one({"_id": it_id}, {"$set": {"manager_id": mit}})
    await db.departments.update_one({"_id": hr_id}, {"$set": {"manager_id": mhr}})
    await db.departments.update_one({"_id": prod_id}, {"$set": {"manager_id": mprod}})

    # Employees
    emps = [
        {"name": "Ion Popescu", "email": "ion.popescu@draxlmaier.ro", "dept_id": it_id},
        {"name": "Maria Ionescu", "email": "maria.ionescu@draxlmaier.ro", "dept_id": it_id},
        {"name": "Andrei Marin", "email": "andrei.marin@draxlmaier.ro", "dept_id": hr_id},
        {"name": "Elena Stan", "email": "elena.stan@draxlmaier.ro", "dept_id": prod_id},
        {"name": "Vlad Dumitrescu", "email": "vlad.dumitrescu@draxlmaier.ro", "dept_id": prod_id},
    ]
    for e in emps:
        e.update({
            "role": "USER",
            "password_hash": hash_password("parola123"),
            "annual_leave_days": 21,
            "available_leave_days": 21,
        })
    await db.users.insert_many(emps)

    # Leave types
    lts = [
        {"name": "Concediu de Odihnă", "code": "CO", "requires_attachment": False, "paid": True},
        {"name": "Concediu Medical", "code": "CM", "requires_attachment": True, "paid": True},
        {"name": "Concediu fără Plată", "code": "FP", "requires_attachment": False, "paid": False},
        {"name": "Eveniment Special", "code": "SPECIAL", "requires_attachment": False, "paid": True},
    ]
    await db.leave_types.insert_many(lts)

    log.info("Demo seeded")


@api.get("/")
async def root():
    return {"message": "Employee Leave Hub API"}


@app.on_event("startup")
async def startup():
    await db.users.create_index("email", unique=True)
    await db.leave_types.create_index("code", unique=True)
    await seed_admin()
    await seed_demo()


@app.on_event("shutdown")
async def shutdown():
    client.close()


app.include_router(api)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)
