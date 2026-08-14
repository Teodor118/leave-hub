from dotenv import load_dotenv
from pathlib import Path

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

import os
import logging
import random
import bcrypt
import jwt
from datetime import datetime, timezone, timedelta, date
from typing import List, Optional, Annotated
from bson import ObjectId
from fastapi import FastAPI, APIRouter, HTTPException, Depends, Request
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
from pydantic import BaseModel, Field, EmailStr, ConfigDict, BeforeValidator, field_validator

# ---------- Setup ----------
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

JWT_SECRET = os.environ['JWT_SECRET']
JWT_ALGO = "HS256"

app = FastAPI()
api = APIRouter(prefix="/api")

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


# ---------- Helpers ----------
def to_object_id(v):
    if isinstance(v, ObjectId):
        return str(v)
    return str(v)

PyObjectId = Annotated[str, BeforeValidator(to_object_id)]


def hash_password(p: str) -> str:
    return bcrypt.hashpw(p.encode(), bcrypt.gensalt()).decode()


def verify_password(p: str, h: str) -> bool:
    try:
        return bcrypt.checkpw(p.encode(), h.encode())
    except Exception:
        return False


def create_token(user_id: str, email: str) -> str:
    payload = {
        "sub": user_id,
        "email": email,
        "exp": datetime.now(timezone.utc) + timedelta(days=7),
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGO)


async def get_current_user(request: Request) -> dict:
    auth = request.headers.get("Authorization", "")
    if not auth.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Neautentificat")
    token = auth[7:]
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGO])
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Sesiune expirată")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Token invalid")
    user = await db.users.find_one({"_id": ObjectId(payload["sub"])})
    if not user:
        raise HTTPException(status_code=401, detail="Utilizator inexistent")
    user["id"] = str(user["_id"])
    user.pop("_id", None)
    user.pop("password_hash", None)
    return user


def oid(x: str) -> ObjectId:
    try:
        return ObjectId(x)
    except Exception:
        raise HTTPException(status_code=400, detail="ID invalid")


def serialize_doc(doc: dict) -> dict:
    if not doc:
        return doc
    doc["id"] = str(doc.pop("_id"))
    for k, v in list(doc.items()):
        if isinstance(v, ObjectId):
            doc[k] = str(v)
    return doc


# ---------- Models ----------
class LoginIn(BaseModel):
    email: EmailStr
    password: str


class ClientIn(BaseModel):
    nume: str = Field(min_length=1, max_length=60)
    prenume: str = Field(min_length=1, max_length=60)
    email: EmailStr
    telefon: str = Field(min_length=6, max_length=25)
    statut: str = Field(default="ACTIV")

    @field_validator("statut")
    @classmethod
    def v_statut(cls, v):
        if v not in ("ACTIV", "INACTIV"):
            raise ValueError("Statutul trebuie să fie ACTIV sau INACTIV")
        return v


class EmployeeIn(BaseModel):
    nume: str = Field(min_length=1, max_length=60)
    prenume: str = Field(min_length=1, max_length=60)
    functie: str = Field(min_length=1, max_length=60)
    salariu: float = Field(ge=2500)
    data_angajarii: Optional[str] = None


class DestinationIn(BaseModel):
    tara: str = Field(min_length=1, max_length=80)
    oras: str = Field(min_length=1, max_length=80)
    tip: str

    @field_validator("tip")
    @classmethod
    def v_tip(cls, v):
        if v not in ("MARE", "MUNTE", "CITY BREAK", "CULTURAL"):
            raise ValueError("Tipul destinației este invalid")
        return v


class PackageIn(BaseModel):
    destination_id: str
    denumire: str = Field(min_length=1, max_length=120)
    pret: float = Field(gt=0)
    zile: int = Field(ge=1, le=30)
    locuri_disponibile: int = Field(ge=0)


class ReservationIn(BaseModel):
    client_id: str
    package_id: str
    employee_id: str
    numar_persoane: int = Field(ge=1, le=20)


class ReservationStatusIn(BaseModel):
    stare: str

    @field_validator("stare")
    @classmethod
    def v_st(cls, v):
        if v not in ("CONFIRMATA", "ANULATA", "FINALIZATA"):
            raise ValueError("Stare invalidă")
        return v


class PaymentIn(BaseModel):
    reservation_id: str
    suma: float = Field(gt=0)
    metoda: str

    @field_validator("metoda")
    @classmethod
    def v_m(cls, v):
        if v not in ("CARD", "CASH", "TRANSFER"):
            raise ValueError("Metoda de plată invalidă")
        return v


# ---------- Auth ----------
@api.post("/auth/login")
async def login(body: LoginIn):
    email = body.email.lower()
    user = await db.users.find_one({"email": email})
    if not user or not verify_password(body.password, user["password_hash"]):
        raise HTTPException(status_code=401, detail="Email sau parolă incorecte")
    token = create_token(str(user["_id"]), email)
    return {
        "token": token,
        "user": {"id": str(user["_id"]), "email": email, "nume": user.get("nume", "Admin")},
    }


@api.get("/auth/me")
async def me(user=Depends(get_current_user)):
    return user


# ---------- Clients ----------
@api.get("/clients")
async def list_clients(q: Optional[str] = None, statut: Optional[str] = None, user=Depends(get_current_user)):
    filt = {}
    if statut and statut in ("ACTIV", "INACTIV"):
        filt["statut"] = statut
    if q:
        filt["$or"] = [
            {"nume": {"$regex": q, "$options": "i"}},
            {"prenume": {"$regex": q, "$options": "i"}},
            {"email": {"$regex": q, "$options": "i"}},
        ]
    docs = await db.clients.find(filt).sort("data_inregistrarii", -1).to_list(1000)
    return [serialize_doc(d) for d in docs]


@api.post("/clients")
async def create_client(body: ClientIn, user=Depends(get_current_user)):
    email = body.email.lower()
    if await db.clients.find_one({"email": email}):
        raise HTTPException(status_code=400, detail="Există deja un client cu acest email")
    doc = body.model_dump()
    doc["email"] = email
    doc["data_inregistrarii"] = datetime.now(timezone.utc).isoformat()
    res = await db.clients.insert_one(doc)
    return serialize_doc(await db.clients.find_one({"_id": res.inserted_id}))


@api.put("/clients/{cid}")
async def update_client(cid: str, body: ClientIn, user=Depends(get_current_user)):
    email = body.email.lower()
    exists = await db.clients.find_one({"email": email, "_id": {"$ne": oid(cid)}})
    if exists:
        raise HTTPException(status_code=400, detail="Există deja un client cu acest email")
    doc = body.model_dump()
    doc["email"] = email
    await db.clients.update_one({"_id": oid(cid)}, {"$set": doc})
    return serialize_doc(await db.clients.find_one({"_id": oid(cid)}))


@api.delete("/clients/{cid}")
async def delete_client(cid: str, user=Depends(get_current_user)):
    r = await db.clients.delete_one({"_id": oid(cid)})
    if r.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Client inexistent")
    return {"ok": True}


# ---------- Employees ----------
@api.get("/employees")
async def list_employees(functie: Optional[str] = None, user=Depends(get_current_user)):
    filt = {}
    if functie:
        filt["functie"] = functie
    docs = await db.employees.find(filt).sort("nume", 1).to_list(1000)
    return [serialize_doc(d) for d in docs]


@api.post("/employees")
async def create_employee(body: EmployeeIn, user=Depends(get_current_user)):
    doc = body.model_dump()
    if not doc.get("data_angajarii"):
        doc["data_angajarii"] = datetime.now(timezone.utc).date().isoformat()
    res = await db.employees.insert_one(doc)
    return serialize_doc(await db.employees.find_one({"_id": res.inserted_id}))


@api.put("/employees/{eid}")
async def update_employee(eid: str, body: EmployeeIn, user=Depends(get_current_user)):
    doc = body.model_dump()
    await db.employees.update_one({"_id": oid(eid)}, {"$set": doc})
    return serialize_doc(await db.employees.find_one({"_id": oid(eid)}))


@api.delete("/employees/{eid}")
async def delete_employee(eid: str, user=Depends(get_current_user)):
    r = await db.employees.delete_one({"_id": oid(eid)})
    if r.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Angajat inexistent")
    return {"ok": True}


# ---------- Destinations ----------
@api.get("/destinations")
async def list_destinations(tip: Optional[str] = None, user=Depends(get_current_user)):
    filt = {}
    if tip:
        filt["tip"] = tip
    docs = await db.destinations.find(filt).sort("tara", 1).to_list(1000)
    return [serialize_doc(d) for d in docs]


@api.post("/destinations")
async def create_destination(body: DestinationIn, user=Depends(get_current_user)):
    res = await db.destinations.insert_one(body.model_dump())
    return serialize_doc(await db.destinations.find_one({"_id": res.inserted_id}))


@api.put("/destinations/{did}")
async def update_destination(did: str, body: DestinationIn, user=Depends(get_current_user)):
    await db.destinations.update_one({"_id": oid(did)}, {"$set": body.model_dump()})
    return serialize_doc(await db.destinations.find_one({"_id": oid(did)}))


@api.delete("/destinations/{did}")
async def delete_destination(did: str, user=Depends(get_current_user)):
    # block if packages exist
    if await db.packages.find_one({"destination_id": oid(did)}):
        raise HTTPException(status_code=400, detail="Există pachete asociate acestei destinații")
    r = await db.destinations.delete_one({"_id": oid(did)})
    if r.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Destinație inexistentă")
    return {"ok": True}


# ---------- Packages ----------
async def _package_with_dest(p):
    p = serialize_doc(p)
    dest = await db.destinations.find_one({"_id": oid(p["destination_id"])})
    p["destination"] = serialize_doc(dest) if dest else None
    return p


@api.get("/packages")
async def list_packages(user=Depends(get_current_user)):
    docs = await db.packages.find({}).sort("denumire", 1).to_list(1000)
    return [await _package_with_dest(d) for d in docs]


@api.post("/packages")
async def create_package(body: PackageIn, user=Depends(get_current_user)):
    if not await db.destinations.find_one({"_id": oid(body.destination_id)}):
        raise HTTPException(status_code=400, detail="Destinație inexistentă")
    doc = body.model_dump()
    doc["destination_id"] = oid(doc["destination_id"])
    res = await db.packages.insert_one(doc)
    return await _package_with_dest(await db.packages.find_one({"_id": res.inserted_id}))


@api.put("/packages/{pid}")
async def update_package(pid: str, body: PackageIn, user=Depends(get_current_user)):
    if not await db.destinations.find_one({"_id": oid(body.destination_id)}):
        raise HTTPException(status_code=400, detail="Destinație inexistentă")
    doc = body.model_dump()
    doc["destination_id"] = oid(doc["destination_id"])
    await db.packages.update_one({"_id": oid(pid)}, {"$set": doc})
    return await _package_with_dest(await db.packages.find_one({"_id": oid(pid)}))


@api.delete("/packages/{pid}")
async def delete_package(pid: str, user=Depends(get_current_user)):
    if await db.reservations.find_one({"package_id": oid(pid)}):
        raise HTTPException(status_code=400, detail="Există rezervări pentru acest pachet")
    r = await db.packages.delete_one({"_id": oid(pid)})
    if r.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Pachet inexistent")
    return {"ok": True}


# ---------- Reservations ----------
async def _reservation_full(r):
    r = serialize_doc(r)
    cli = await db.clients.find_one({"_id": oid(r["client_id"])})
    pkg = await db.packages.find_one({"_id": oid(r["package_id"])})
    emp = await db.employees.find_one({"_id": oid(r["employee_id"])})
    r["client"] = serialize_doc(cli) if cli else None
    r["package"] = await _package_with_dest(pkg) if pkg else None
    r["employee"] = serialize_doc(emp) if emp else None
    # aggregate payments
    pays = await db.payments.find({"reservation_id": oid(r["id"])}).to_list(1000)
    r["total_platit"] = round(sum(p["suma"] for p in pays), 2)
    r["sold"] = round(r["valoare"] - r["total_platit"], 2)
    return r


@api.get("/reservations")
async def list_reservations(user=Depends(get_current_user)):
    docs = await db.reservations.find({}).sort("data_rezervare", -1).to_list(1000)
    return [await _reservation_full(d) for d in docs]


@api.post("/reservations")
async def create_reservation(body: ReservationIn, user=Depends(get_current_user)):
    pkg = await db.packages.find_one({"_id": oid(body.package_id)})
    if not pkg:
        raise HTTPException(status_code=400, detail="Pachet inexistent")
    if not await db.clients.find_one({"_id": oid(body.client_id)}):
        raise HTTPException(status_code=400, detail="Client inexistent")
    if not await db.employees.find_one({"_id": oid(body.employee_id)}):
        raise HTTPException(status_code=400, detail="Angajat inexistent")

    # Atomic decrement locuri_disponibile ensuring enough seats
    res = await db.packages.update_one(
        {"_id": oid(body.package_id), "locuri_disponibile": {"$gte": body.numar_persoane}},
        {"$inc": {"locuri_disponibile": -body.numar_persoane}},
    )
    if res.modified_count == 0:
        raise HTTPException(status_code=400, detail="Locuri insuficiente pentru acest pachet")

    valoare = round(pkg["pret"] * body.numar_persoane, 2)
    doc = {
        "client_id": oid(body.client_id),
        "package_id": oid(body.package_id),
        "employee_id": oid(body.employee_id),
        "numar_persoane": body.numar_persoane,
        "valoare": valoare,
        "stare": "CONFIRMATA",
        "data_rezervare": datetime.now(timezone.utc).isoformat(),
    }
    ins = await db.reservations.insert_one(doc)
    return await _reservation_full(await db.reservations.find_one({"_id": ins.inserted_id}))


@api.put("/reservations/{rid}/status")
async def change_reservation_status(rid: str, body: ReservationStatusIn, user=Depends(get_current_user)):
    r = await db.reservations.find_one({"_id": oid(rid)})
    if not r:
        raise HTTPException(status_code=404, detail="Rezervare inexistentă")
    old = r["stare"]
    new = body.stare
    if old == new:
        return await _reservation_full(r)

    # Handle seat restoration/deduction transitions
    if old != "ANULATA" and new == "ANULATA":
        # restore seats
        await db.packages.update_one(
            {"_id": r["package_id"]},
            {"$inc": {"locuri_disponibile": r["numar_persoane"]}},
        )
    elif old == "ANULATA" and new in ("CONFIRMATA", "FINALIZATA"):
        # try to re-deduct
        res = await db.packages.update_one(
            {"_id": r["package_id"], "locuri_disponibile": {"$gte": r["numar_persoane"]}},
            {"$inc": {"locuri_disponibile": -r["numar_persoane"]}},
        )
        if res.modified_count == 0:
            raise HTTPException(status_code=400, detail="Locuri insuficiente pentru reactivare")

    await db.reservations.update_one({"_id": oid(rid)}, {"$set": {"stare": new}})
    return await _reservation_full(await db.reservations.find_one({"_id": oid(rid)}))


@api.delete("/reservations/{rid}")
async def delete_reservation(rid: str, user=Depends(get_current_user)):
    r = await db.reservations.find_one({"_id": oid(rid)})
    if not r:
        raise HTTPException(status_code=404, detail="Rezervare inexistentă")
    # restore seats if not cancelled
    if r["stare"] != "ANULATA":
        await db.packages.update_one(
            {"_id": r["package_id"]},
            {"$inc": {"locuri_disponibile": r["numar_persoane"]}},
        )
    await db.payments.delete_many({"reservation_id": oid(rid)})
    await db.reservations.delete_one({"_id": oid(rid)})
    return {"ok": True}


# ---------- Payments ----------
async def _payment_full(p):
    p = serialize_doc(p)
    r = await db.reservations.find_one({"_id": oid(p["reservation_id"])})
    if r:
        c = await db.clients.find_one({"_id": r["client_id"]})
        p["reservation"] = {
            "id": str(r["_id"]),
            "valoare": r["valoare"],
            "client_nume": f"{c['nume']} {c['prenume']}" if c else "-",
        }
    return p


@api.get("/payments")
async def list_payments(user=Depends(get_current_user)):
    docs = await db.payments.find({}).sort("data_plata", -1).to_list(1000)
    return [await _payment_full(d) for d in docs]


@api.post("/payments")
async def create_payment(body: PaymentIn, user=Depends(get_current_user)):
    r = await db.reservations.find_one({"_id": oid(body.reservation_id)})
    if not r:
        raise HTTPException(status_code=400, detail="Rezervare inexistentă")
    # compute sold
    pays = await db.payments.find({"reservation_id": r["_id"]}).to_list(1000)
    total = sum(p["suma"] for p in pays)
    sold = r["valoare"] - total
    if body.suma > sold + 0.01:
        raise HTTPException(status_code=400, detail=f"Suma depășește soldul rămas ({sold:.2f} RON)")
    doc = {
        "reservation_id": r["_id"],
        "suma": round(body.suma, 2),
        "metoda": body.metoda,
        "data_plata": datetime.now(timezone.utc).isoformat(),
    }
    ins = await db.payments.insert_one(doc)
    return await _payment_full(await db.payments.find_one({"_id": ins.inserted_id}))


@api.delete("/payments/{pid}")
async def delete_payment(pid: str, user=Depends(get_current_user)):
    r = await db.payments.delete_one({"_id": oid(pid)})
    if r.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Plată inexistentă")
    return {"ok": True}


# ---------- Reports & Dashboard ----------
@api.get("/reports/dashboard")
async def dashboard(user=Depends(get_current_user)):
    total_reservations = await db.reservations.count_documents({})
    active_clients = await db.clients.count_documents({"statut": "ACTIV"})
    total_packages = await db.packages.count_documents({})

    pays = await db.payments.find({}).to_list(10000)
    total_revenue = round(sum(p["suma"] for p in pays), 2)

    # reservations per client
    pipeline_rc = [
        {"$group": {"_id": "$client_id", "count": {"$sum": 1}, "total": {"$sum": "$valoare"}}},
        {"$sort": {"count": -1}},
        {"$limit": 8},
    ]
    rc = await db.reservations.aggregate(pipeline_rc).to_list(100)
    reservations_per_client = []
    for r in rc:
        c = await db.clients.find_one({"_id": r["_id"]})
        if c:
            reservations_per_client.append({
                "client": f"{c['nume']} {c['prenume']}",
                "count": r["count"],
                "total": round(r["total"], 2),
            })

    # popular packages
    pipeline_pp = [
        {"$group": {"_id": "$package_id", "count": {"$sum": 1}, "persoane": {"$sum": "$numar_persoane"}}},
        {"$sort": {"count": -1}},
        {"$limit": 8},
    ]
    pp = await db.reservations.aggregate(pipeline_pp).to_list(100)
    popular_packages = []
    for r in pp:
        p = await db.packages.find_one({"_id": r["_id"]})
        if p:
            popular_packages.append({
                "denumire": p["denumire"],
                "count": r["count"],
                "persoane": r["persoane"],
            })

    # revenue per method
    pipeline_rm = [
        {"$group": {"_id": "$metoda", "total": {"$sum": "$suma"}, "count": {"$sum": 1}}},
    ]
    rm = await db.payments.aggregate(pipeline_rm).to_list(100)
    revenue_by_method = [{"metoda": r["_id"], "total": round(r["total"], 2), "count": r["count"]} for r in rm]

    return {
        "kpi": {
            "total_reservations": total_reservations,
            "total_revenue": total_revenue,
            "active_clients": active_clients,
            "total_packages": total_packages,
        },
        "reservations_per_client": reservations_per_client,
        "popular_packages": popular_packages,
        "revenue_by_method": revenue_by_method,
    }


@api.get("/reports/detailed")
async def detailed_report(user=Depends(get_current_user)):
    docs = await db.reservations.find({}).sort("data_rezervare", -1).to_list(1000)
    return [await _reservation_full(d) for d in docs]


# ---------- Seed ----------
async def seed_admin():
    email = os.environ.get("ADMIN_EMAIL", "admin@turism.ro").lower()
    pwd = os.environ.get("ADMIN_PASSWORD", "admin123")
    existing = await db.users.find_one({"email": email})
    if not existing:
        await db.users.insert_one({
            "email": email,
            "password_hash": hash_password(pwd),
            "nume": "Administrator",
            "created_at": datetime.now(timezone.utc).isoformat(),
        })
        logger.info(f"Seeded admin: {email}")
    elif not verify_password(pwd, existing["password_hash"]):
        await db.users.update_one({"email": email}, {"$set": {"password_hash": hash_password(pwd)}})
        logger.info(f"Updated admin password: {email}")


async def seed_demo_data(force: bool = False):
    if not force and await db.clients.count_documents({}) > 0:
        return {"skipped": True}

    # clear
    for c in ("clients", "employees", "destinations", "packages", "reservations", "payments"):
        await db[c].delete_many({})

    now_iso = datetime.now(timezone.utc).isoformat()

    # Clients
    ro_first = ["Andrei", "Maria", "Ion", "Elena", "Vlad", "Ana", "Radu", "Ioana", "Mihai", "Cristina"]
    ro_last = ["Popescu", "Ionescu", "Georgescu", "Dumitrescu", "Stan", "Marin", "Radu", "Popa", "Constantin", "Munteanu"]
    clients_docs = []
    for i in range(10):
        clients_docs.append({
            "nume": ro_last[i],
            "prenume": ro_first[i],
            "email": f"{ro_first[i].lower()}.{ro_last[i].lower()}@example.com",
            "telefon": f"07{random.randint(10000000, 99999999)}",
            "data_inregistrarii": now_iso,
            "statut": random.choice(["ACTIV", "ACTIV", "ACTIV", "INACTIV"]),
        })
    cli_res = await db.clients.insert_many(clients_docs)
    cli_ids = cli_res.inserted_ids

    # Employees
    functii = ["Agent turism", "Manager", "Consilier", "Contabil", "Rezervări"]
    employees_docs = []
    for i in range(5):
        employees_docs.append({
            "nume": ro_last[i + 3],
            "prenume": ro_first[i + 2],
            "functie": functii[i],
            "salariu": float(random.randint(2500, 8000)),
            "data_angajarii": (datetime.now(timezone.utc) - timedelta(days=random.randint(100, 2000))).date().isoformat(),
        })
    emp_res = await db.employees.insert_many(employees_docs)
    emp_ids = emp_res.inserted_ids

    # Destinations
    destinations_docs = [
        {"tara": "Grecia", "oras": "Santorini", "tip": "MARE"},
        {"tara": "Franța", "oras": "Chamonix", "tip": "MUNTE"},
        {"tara": "Italia", "oras": "Roma", "tip": "CITY BREAK"},
        {"tara": "Egipt", "oras": "Hurghada", "tip": "MARE"},
        {"tara": "Turcia", "oras": "Istanbul", "tip": "CULTURAL"},
    ]
    dest_res = await db.destinations.insert_many(destinations_docs)
    dest_ids = dest_res.inserted_ids

    # Packages
    packages_docs = [
        {"destination_id": dest_ids[0], "denumire": "Santorini Sunset 7 zile", "pret": 3200.0, "zile": 7, "locuri_disponibile": 20},
        {"destination_id": dest_ids[0], "denumire": "Santorini All-Inclusive 5 zile", "pret": 2500.0, "zile": 5, "locuri_disponibile": 15},
        {"destination_id": dest_ids[1], "denumire": "Chamonix Ski 6 zile", "pret": 4500.0, "zile": 6, "locuri_disponibile": 12},
        {"destination_id": dest_ids[2], "denumire": "Roma City Break 4 zile", "pret": 1800.0, "zile": 4, "locuri_disponibile": 25},
        {"destination_id": dest_ids[2], "denumire": "Roma Cultural 7 zile", "pret": 2900.0, "zile": 7, "locuri_disponibile": 18},
        {"destination_id": dest_ids[3], "denumire": "Hurghada Resort 10 zile", "pret": 3800.0, "zile": 10, "locuri_disponibile": 30},
        {"destination_id": dest_ids[4], "denumire": "Istanbul Cultural 5 zile", "pret": 2100.0, "zile": 5, "locuri_disponibile": 22},
        {"destination_id": dest_ids[4], "denumire": "Istanbul Weekend 3 zile", "pret": 1200.0, "zile": 3, "locuri_disponibile": 28},
    ]
    pkg_res = await db.packages.insert_many(packages_docs)
    pkg_ids = pkg_res.inserted_ids

    # Reservations (10) - decrement seats accordingly
    reservations_docs = []
    for i in range(10):
        pkg_idx = i % len(pkg_ids)
        persoane = random.randint(1, 4)
        pkg = packages_docs[pkg_idx]
        if pkg["locuri_disponibile"] < persoane:
            persoane = pkg["locuri_disponibile"]
        if persoane == 0:
            continue
        pkg["locuri_disponibile"] -= persoane
        stare = random.choice(["CONFIRMATA", "CONFIRMATA", "FINALIZATA", "ANULATA"])
        # Reflect seat restoration for ANULATA
        if stare == "ANULATA":
            pkg["locuri_disponibile"] += persoane
        reservations_docs.append({
            "client_id": cli_ids[i % len(cli_ids)],
            "package_id": pkg_ids[pkg_idx],
            "employee_id": emp_ids[i % len(emp_ids)],
            "numar_persoane": persoane,
            "valoare": round(pkg["pret"] * persoane, 2),
            "stare": stare,
            "data_rezervare": (datetime.now(timezone.utc) - timedelta(days=random.randint(1, 60))).isoformat(),
        })
    # Update packages with new seat counts
    for i, pid in enumerate(pkg_ids):
        await db.packages.update_one({"_id": pid}, {"$set": {"locuri_disponibile": packages_docs[i]["locuri_disponibile"]}})

    if reservations_docs:
        rez_res = await db.reservations.insert_many(reservations_docs)
        rez_ids = rez_res.inserted_ids

        # Payments (some full, some partial)
        payments_docs = []
        methods = ["CARD", "CASH", "TRANSFER"]
        for i, rid in enumerate(rez_ids):
            r = reservations_docs[i]
            if r["stare"] == "ANULATA":
                continue
            if r["stare"] == "FINALIZATA":
                # full payment
                payments_docs.append({
                    "reservation_id": rid,
                    "suma": r["valoare"],
                    "metoda": random.choice(methods),
                    "data_plata": (datetime.now(timezone.utc) - timedelta(days=random.randint(1, 30))).isoformat(),
                })
            else:
                # partial ~50%
                half = round(r["valoare"] / 2, 2)
                payments_docs.append({
                    "reservation_id": rid,
                    "suma": half,
                    "metoda": random.choice(methods),
                    "data_plata": (datetime.now(timezone.utc) - timedelta(days=random.randint(1, 30))).isoformat(),
                })
        if payments_docs:
            await db.payments.insert_many(payments_docs)

    return {"ok": True, "clients": len(cli_ids), "reservations": len(reservations_docs)}


@api.post("/seed")
async def reseed(user=Depends(get_current_user)):
    return await seed_demo_data(force=True)


@api.get("/")
async def root():
    return {"message": "Turism API"}


# ---------- Startup ----------
@app.on_event("startup")
async def startup():
    await db.users.create_index("email", unique=True)
    await db.clients.create_index("email", unique=True)
    await seed_admin()
    await seed_demo_data(force=False)


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
