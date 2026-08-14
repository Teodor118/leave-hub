"""End-to-end backend API tests for Employee Leave Hub."""
import os
import base64
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://travel-agency-hub-46.preview.emergentagent.com").rstrip("/")
API = f"{BASE_URL}/api"

ADMIN = ("ragemonster069@gmail.com", "admin123")
MGR_IT = ("manager.it@draxlmaier.ro", "parola123")
MGR_HR = ("manager.hr@draxlmaier.ro", "parola123")
EMP_ION = ("ion.popescu@draxlmaier.ro", "parola123")
EMP_MARIA = ("maria.ionescu@draxlmaier.ro", "parola123")
EMP_ELENA = ("elena.stan@draxlmaier.ro", "parola123")  # Producție


def _login(email, pwd):
    r = requests.post(f"{API}/auth/login", json={"email": email, "password": pwd})
    assert r.status_code == 200, f"login failed: {r.status_code} {r.text}"
    return r.json()


def _hdr(token):
    return {"Authorization": f"Bearer {token}"}


# --------- Auth ---------
class TestAuth:
    def test_login_admin(self):
        d = _login(*ADMIN)
        assert d["user"]["role"] == "ADMIN"
        assert d["token"]

    def test_login_manager(self):
        d = _login(*MGR_IT)
        assert d["user"]["role"] == "DEPT_RESP"

    def test_login_employee(self):
        d = _login(*EMP_ION)
        assert d["user"]["role"] == "USER"

    def test_login_bad_password(self):
        r = requests.post(f"{API}/auth/login", json={"email": EMP_ION[0], "password": "wrong"})
        assert r.status_code == 401
        assert "Email sau parolă incorecte" in r.json().get("detail", "")

    def test_me_has_department(self):
        d = _login(*EMP_ION)
        r = requests.get(f"{API}/auth/me", headers=_hdr(d["token"]))
        assert r.status_code == 200
        me = r.json()
        assert me["role"] == "USER"
        assert me.get("department") is not None
        assert me["department"]["department_name"] == "IT"


# --------- Leave Request Lifecycle ---------
@pytest.fixture(scope="module")
def tokens():
    return {
        "admin": _login(*ADMIN)["token"],
        "mgr_it": _login(*MGR_IT)["token"],
        "mgr_hr": _login(*MGR_HR)["token"],
        "ion": _login(*EMP_ION),
        "maria": _login(*EMP_MARIA),
        "elena": _login(*EMP_ELENA),
    }


@pytest.fixture(scope="module")
def leave_types(tokens):
    r = requests.get(f"{API}/leave-types", headers=_hdr(tokens["admin"]))
    assert r.status_code == 200
    d = {lt["code"]: lt for lt in r.json()}
    return d


class TestWorkingDaysPreview:
    def test_preview(self, tokens):
        # 2026-03-02 (Mon) to 2026-03-06 (Fri) = 5 weekdays, none are RO holidays
        r = requests.get(f"{API}/leave-requests/preview/working-days",
                         params={"start_date": "2026-03-02", "end_date": "2026-03-06"},
                         headers=_hdr(tokens["ion"]["token"]))
        assert r.status_code == 200
        assert r.json()["working_days"] == 5

    def test_preview_with_holiday(self, tokens):
        # 2026-01-01 to 2026-01-09 includes 01-01,01-02,01-06,01-07 as holidays
        # Range: Thu 1, Fri 2, Mon 5, Tue 6, Wed 7, Thu 8, Fri 9 (weekdays only) = 7 weekdays
        # Minus holidays 1,2,6,7 -> 3 working days (Mon 5, Thu 8, Fri 9)
        r = requests.get(f"{API}/leave-requests/preview/working-days",
                         params={"start_date": "2026-01-01", "end_date": "2026-01-09"},
                         headers=_hdr(tokens["ion"]["token"]))
        assert r.status_code == 200
        assert r.json()["working_days"] == 3


class TestLeaveRequestFlow:
    request_id = None
    draft_id = None

    def test_1_create_pending(self, tokens, leave_types):
        # Use a unique future date range to avoid clashes with pre-seeded request
        r = requests.post(f"{API}/leave-requests",
                          headers=_hdr(tokens["maria"]["token"]),
                          json={
                              "leave_type_id": leave_types["CO"]["id"],
                              "start_date": "2026-04-06",  # Mon
                              "end_date": "2026-04-09",    # Thu (Fri 4-10 is holiday)
                              "submit": True,
                          })
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["status"] == "PENDING"
        assert d["working_days"] == 4
        TestLeaveRequestFlow.request_id = d["id"]

    def test_2_other_employee_cannot_read(self, tokens):
        rid = TestLeaveRequestFlow.request_id
        # Ion tries to read Maria's request
        r = requests.get(f"{API}/leave-requests/{rid}", headers=_hdr(tokens["ion"]["token"]))
        assert r.status_code == 403

    def test_3_insufficient_balance(self, tokens, leave_types):
        # Elena has 21 days -> request 22 working days
        r = requests.post(f"{API}/leave-requests",
                          headers=_hdr(tokens["elena"]["token"]),
                          json={
                              "leave_type_id": leave_types["CO"]["id"],
                              "start_date": "2026-06-08",
                              "end_date": "2026-07-31",
                              "submit": True,
                          })
        assert r.status_code == 400
        assert "Sold insuficient" in r.json().get("detail", "")

    def test_4_draft_then_submit(self, tokens, leave_types):
        r = requests.post(f"{API}/leave-requests",
                          headers=_hdr(tokens["ion"]["token"]),
                          json={
                              "leave_type_id": leave_types["CO"]["id"],
                              "start_date": "2026-05-04",
                              "end_date": "2026-05-05",
                              "submit": False,
                          })
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["status"] == "DRAFT"
        TestLeaveRequestFlow.draft_id = d["id"]

        # Submit
        r = requests.put(f"{API}/leave-requests/{d['id']}/action",
                         headers=_hdr(tokens["ion"]["token"]),
                         json={"action": "SUBMIT"})
        assert r.status_code == 200
        assert r.json()["status"] == "PENDING"

        # workflow
        w = requests.get(f"{API}/leave-requests/{d['id']}/workflow",
                        headers=_hdr(tokens["ion"]["token"]))
        assert w.status_code == 200
        states = [x["current_status"] for x in w.json()]
        assert "DRAFT" in states and "PENDING" in states

    def test_5_manager_sees_department(self, tokens):
        r = requests.get(f"{API}/leave-requests", params={"scope": "department"},
                         headers=_hdr(tokens["mgr_it"]))
        assert r.status_code == 200
        docs = r.json()
        # Should include Maria's & Ion's, not Elena's
        emails = {d["employee_email"] for d in docs}
        assert "elena.stan@draxlmaier.ro" not in emails

    def test_6_manager_reject_without_comment(self, tokens):
        rid = TestLeaveRequestFlow.request_id
        r = requests.put(f"{API}/leave-requests/{rid}/action",
                         headers=_hdr(tokens["mgr_it"]),
                         json={"action": "REJECT"})
        assert r.status_code == 400
        assert "motiv" in r.json().get("detail", "").lower()

    def test_7_cross_dept_manager_cannot_approve(self, tokens):
        rid = TestLeaveRequestFlow.request_id  # Maria (IT)
        r = requests.put(f"{API}/leave-requests/{rid}/action",
                         headers=_hdr(tokens["mgr_hr"]),
                         json={"action": "APPROVE"})
        assert r.status_code == 403

    def test_8_manager_approve_balance_decreases(self, tokens):
        rid = TestLeaveRequestFlow.request_id
        # Before balance
        me_before = requests.get(f"{API}/auth/me", headers=_hdr(tokens["maria"]["token"])).json()
        before = me_before["available_leave_days"]

        r = requests.put(f"{API}/leave-requests/{rid}/action",
                         headers=_hdr(tokens["mgr_it"]),
                         json={"action": "APPROVE"})
        assert r.status_code == 200, r.text
        assert r.json()["status"] == "APPROVED"

        me_after = requests.get(f"{API}/auth/me", headers=_hdr(tokens["maria"]["token"])).json()
        assert me_after["available_leave_days"] == before - 4

    def test_9_cancel_approved_forbidden(self, tokens):
        rid = TestLeaveRequestFlow.request_id
        r = requests.put(f"{API}/leave-requests/{rid}/action",
                         headers=_hdr(tokens["maria"]["token"]),
                         json={"action": "CANCEL"})
        assert r.status_code == 400

    def test_10_cancel_pending_ok(self, tokens):
        rid = TestLeaveRequestFlow.draft_id  # PENDING
        r = requests.put(f"{API}/leave-requests/{rid}/action",
                         headers=_hdr(tokens["ion"]["token"]),
                         json={"action": "CANCEL"})
        assert r.status_code == 200
        assert r.json()["status"] == "CANCELLED"

    def test_11_pdf_only_approved(self, tokens):
        rid = TestLeaveRequestFlow.draft_id  # CANCELLED
        r = requests.get(f"{API}/leave-requests/{rid}/pdf",
                         headers=_hdr(tokens["ion"]["token"]))
        assert r.status_code == 400

        rid_ok = TestLeaveRequestFlow.request_id  # APPROVED
        r = requests.get(f"{API}/leave-requests/{rid_ok}/pdf",
                         headers=_hdr(tokens["maria"]["token"]))
        assert r.status_code == 200
        assert r.headers["content-type"] == "application/pdf"
        assert r.content[:4] == b"%PDF"

    def test_12_admin_delete_refund(self, tokens):
        rid = TestLeaveRequestFlow.request_id  # APPROVED, 4 days deducted
        me_before = requests.get(f"{API}/auth/me", headers=_hdr(tokens["maria"]["token"])).json()
        before = me_before["available_leave_days"]

        r = requests.delete(f"{API}/leave-requests/{rid}", headers=_hdr(tokens["admin"]))
        assert r.status_code == 200

        me_after = requests.get(f"{API}/auth/me", headers=_hdr(tokens["maria"]["token"])).json()
        assert me_after["available_leave_days"] == before + 4

    def test_13_admin_scope_all(self, tokens):
        r = requests.get(f"{API}/leave-requests", params={"scope": "all"}, headers=_hdr(tokens["admin"]))
        assert r.status_code == 200
        assert isinstance(r.json(), list)


class TestAttachment:
    def test_cm_requires_attachment(self, tokens, leave_types):
        r = requests.post(f"{API}/leave-requests",
                          headers=_hdr(tokens["ion"]["token"]),
                          json={
                              "leave_type_id": leave_types["CM"]["id"],
                              "start_date": "2026-05-11",
                              "end_date": "2026-05-12",
                              "submit": True,
                          })
        assert r.status_code == 400
        assert "atașament" in r.json().get("detail", "").lower()

    def test_cm_with_attachment(self, tokens, leave_types):
        content = base64.b64encode(b"fake pdf content").decode()
        r = requests.post(f"{API}/leave-requests",
                          headers=_hdr(tokens["ion"]["token"]),
                          json={
                              "leave_type_id": leave_types["CM"]["id"],
                              "start_date": "2026-05-11",
                              "end_date": "2026-05-12",
                              "submit": True,
                              "attachment": {"file_name": "med.pdf", "content_base64": content},
                          })
        assert r.status_code == 200, r.text
        d = r.json()
        assert len(d["attachments"]) == 1
        aid = d["attachments"][0]["id"]
        # Retrieve
        r2 = requests.get(f"{API}/attachments/{aid}", headers=_hdr(tokens["ion"]["token"]))
        assert r2.status_code == 200
        assert r2.json()["content_base64"] == content
        # Cleanup - cancel then admin delete
        requests.put(f"{API}/leave-requests/{d['id']}/action",
                     headers=_hdr(tokens["ion"]["token"]), json={"action": "CANCEL"})
        requests.delete(f"{API}/leave-requests/{d['id']}", headers=_hdr(tokens["admin"]))


class TestDashboard:
    def test_user_dashboard(self, tokens):
        r = requests.get(f"{API}/dashboard", headers=_hdr(tokens["ion"]["token"]))
        assert r.status_code == 200
        d = r.json()
        assert d["role"] == "USER"
        assert "balance" in d and "by_status" in d and "recent" in d

    def test_manager_dashboard(self, tokens):
        r = requests.get(f"{API}/dashboard", headers=_hdr(tokens["mgr_it"]))
        assert r.status_code == 200
        d = r.json()
        assert d["role"] == "DEPT_RESP"
        assert d["kpi"]["team_size"] >= 1
        assert "pending_list" in d

    def test_admin_dashboard(self, tokens):
        r = requests.get(f"{API}/dashboard", headers=_hdr(tokens["admin"]))
        assert r.status_code == 200
        d = r.json()
        assert d["role"] == "ADMIN"
        assert "per_department" in d and "per_leave_type" in d


class TestCalendar:
    def test_calendar_user(self, tokens):
        r = requests.get(f"{API}/calendar",
                         params={"start": "2026-01-01", "end": "2026-12-31"},
                         headers=_hdr(tokens["ion"]["token"]))
        assert r.status_code == 200
        assert isinstance(r.json(), list)


class TestAdminCRUD:
    def test_duplicate_email(self, tokens):
        r = requests.post(f"{API}/users", headers=_hdr(tokens["admin"]),
                          json={"name": "Dup", "email": "ion.popescu@draxlmaier.ro",
                                "password": "parola123", "role": "USER"})
        assert r.status_code == 400
        assert "Există deja" in r.json().get("detail", "")

    def test_duplicate_leave_type_code(self, tokens):
        r = requests.post(f"{API}/leave-types", headers=_hdr(tokens["admin"]),
                          json={"name": "Copy CO", "code": "CO", "requires_attachment": False, "paid": True})
        assert r.status_code == 400

    def test_delete_dept_with_users(self, tokens):
        depts = requests.get(f"{API}/departments", headers=_hdr(tokens["admin"])).json()
        it_dept = next(d for d in depts if d["department_name"] == "IT")
        r = requests.delete(f"{API}/departments/{it_dept['id']}", headers=_hdr(tokens["admin"]))
        assert r.status_code == 400

    def test_user_crud_cycle(self, tokens):
        # create
        r = requests.post(f"{API}/users", headers=_hdr(tokens["admin"]),
                          json={"name": "TEST User", "email": "test_temp@draxlmaier.ro",
                                "password": "parola123", "role": "USER"})
        assert r.status_code == 200
        uid = r.json()["id"]
        # update
        r2 = requests.put(f"{API}/users/{uid}", headers=_hdr(tokens["admin"]),
                          json={"name": "TEST Renamed", "email": "test_temp@draxlmaier.ro",
                                "role": "USER"})
        assert r2.status_code == 200
        # get list & verify
        users = requests.get(f"{API}/users", headers=_hdr(tokens["admin"])).json()
        assert any(u["id"] == uid and u["name"] == "TEST Renamed" for u in users)
        # delete
        r3 = requests.delete(f"{API}/users/{uid}", headers=_hdr(tokens["admin"]))
        assert r3.status_code == 200
