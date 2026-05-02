"""
Backend regression + Sheets sync tests for Logistics CRM.
Hits the public REACT/EXPO backend URL (with /api prefix).
"""
import os
import sys
import json
import requests
from pathlib import Path

# Read base URL from frontend .env
BASE = None
env_path = Path("/app/frontend/.env")
for line in env_path.read_text().splitlines():
    if line.startswith("EXPO_PUBLIC_BACKEND_URL="):
        BASE = line.split("=", 1)[1].strip().strip('"')
        break

if not BASE:
    print("FATAL: EXPO_PUBLIC_BACKEND_URL not found in frontend/.env")
    sys.exit(1)

API = BASE.rstrip("/") + "/api"
print(f"Testing against: {API}")

results = []  # list of (label, passed:bool, details:str)


def record(label, passed, details=""):
    results.append((label, passed, details))
    mark = "PASS" if passed else "FAIL"
    print(f"[{mark}] {label} :: {details[:300]}")


def safe_json(resp):
    try:
        return resp.json()
    except Exception:
        return {"_raw": resp.text[:300]}


# ---------------- Sheets sync endpoints ----------------
def test_sheets_status():
    try:
        r = requests.get(f"{API}/sync/sheets/status", timeout=30)
        body = safe_json(r)
        ok_http = (r.status_code == 200)
        has_keys = isinstance(body, dict) and ("ok" in body) and ("message" in body)
        record(
            "GET /api/sync/sheets/status",
            ok_http and has_keys,
            f"status={r.status_code} body={json.dumps(body, ensure_ascii=False)[:300]}",
        )
    except Exception as e:
        record("GET /api/sync/sheets/status", False, f"exception: {e}")


def test_sheets_post():
    try:
        r = requests.post(f"{API}/sync/sheets", timeout=60)
        body = safe_json(r)
        ok_http = (r.status_code == 200)
        ok_shape = isinstance(body, dict) and ("ok" in body)
        msg_ok = True
        if isinstance(body, dict) and body.get("ok") is False:
            msg_ok = isinstance(body.get("message"), str) and len(body.get("message", "")) > 0
        record(
            "POST /api/sync/sheets",
            ok_http and ok_shape and msg_ok,
            f"status={r.status_code} body={json.dumps(body, ensure_ascii=False)[:400]}",
        )
    except Exception as e:
        record("POST /api/sync/sheets", False, f"exception: {e}")


# ---------------- CRUD regression ----------------
def crud_cycle(prefix, create_payload, update_payload, expect_id_field="id", label_prefix=""):
    """Returns True if the full cycle passed."""
    lp = label_prefix or prefix
    item_id = None
    # CREATE
    try:
        r = requests.post(f"{API}/{prefix}", json=create_payload, timeout=20)
        body = safe_json(r)
        passed = r.status_code == 200 and isinstance(body, dict) and body.get(expect_id_field)
        record(f"POST /api/{prefix} (create)", passed,
               f"status={r.status_code} id={body.get(expect_id_field) if isinstance(body, dict) else None}")
        if not passed:
            return False
        item_id = body[expect_id_field]
    except Exception as e:
        record(f"POST /api/{prefix} (create)", False, f"exception: {e}")
        return False

    # LIST
    try:
        r = requests.get(f"{API}/{prefix}", timeout=20)
        body = safe_json(r)
        passed = r.status_code == 200 and isinstance(body, list) and any(
            (isinstance(x, dict) and x.get(expect_id_field) == item_id) for x in body
        )
        record(f"GET /api/{prefix} (list contains created)", passed,
               f"status={r.status_code} count={len(body) if isinstance(body, list) else 'n/a'}")
    except Exception as e:
        record(f"GET /api/{prefix} (list)", False, f"exception: {e}")

    # GET BY ID (skip for leads — server doesn't expose? actually does via make_crud)
    try:
        r = requests.get(f"{API}/{prefix}/{item_id}", timeout=20)
        body = safe_json(r)
        passed = r.status_code == 200 and isinstance(body, dict) and body.get(expect_id_field) == item_id
        record(f"GET /api/{prefix}/{{id}}", passed, f"status={r.status_code}")
    except Exception as e:
        record(f"GET /api/{prefix}/{{id}}", False, f"exception: {e}")

    # PUT update
    try:
        r = requests.put(f"{API}/{prefix}/{item_id}", json=update_payload, timeout=20)
        body = safe_json(r)
        passed = r.status_code == 200 and isinstance(body, dict)
        # Validate at least one updated field roundtrips
        for k, v in update_payload.items():
            if isinstance(v, str) and v and body.get(k) != v:
                passed = False
                break
        record(f"PUT /api/{prefix}/{{id}}", passed,
               f"status={r.status_code} body_keys={list(body.keys())[:8] if isinstance(body, dict) else 'n/a'}")
    except Exception as e:
        record(f"PUT /api/{prefix}/{{id}}", False, f"exception: {e}")

    # DELETE
    try:
        r = requests.delete(f"{API}/{prefix}/{item_id}", timeout=20)
        body = safe_json(r)
        passed = r.status_code == 200 and isinstance(body, dict) and body.get("ok") is True
        record(f"DELETE /api/{prefix}/{{id}}", passed, f"status={r.status_code} body={body}")
    except Exception as e:
        record(f"DELETE /api/{prefix}/{{id}}", False, f"exception: {e}")

    # Verify deletion
    try:
        r = requests.get(f"{API}/{prefix}/{item_id}", timeout=20)
        passed = r.status_code == 404
        record(f"GET /api/{prefix}/{{id}} after delete (expect 404)", passed, f"status={r.status_code}")
    except Exception as e:
        record(f"GET /api/{prefix}/{{id}} after delete", False, f"exception: {e}")

    return True


def test_clients():
    crud_cycle(
        "clients",
        {"name": "ООО Тест-Клиент API", "phone": "+7 (495) 999-00-11", "inn": "7799887766"},
        # PUT for clients uses ClientPayload (full payload, name required)
        {"name": "ООО Тест-Клиент API (обновлён)", "phone": "+7 (495) 999-00-22", "inn": "7799887766"},
    )


def test_carriers():
    crud_cycle(
        "carriers",
        {"company_name": "ИП Тест-Перевозчик API", "driver_name": "Иванов И.И.", "phone": "+7 (905) 555-00-11"},
        {"company_name": "ИП Тест-Перевозчик API (обновлён)", "driver_name": "Иванов И.И.", "phone": "+7 (905) 555-00-22"},
    )


def test_orders():
    # OrderPayload requires order_number, route_from, route_to
    create = {
        "order_number": "TEST-API-001",
        "route_from": "Москва",
        "route_to": "Санкт-Петербург",
        "client_name": "Тестовый клиент",
        "carrier_name": "Тестовый перевозчик",
        "client_rate": 100000,
        "carrier_rate": 80000,
        "status": "new",
    }
    # Orders use OrderUpdate (partial); send partial fields
    update = {
        "status": "in_progress",
        "client_paid": True,
        "notes": "обновлено через API-тест",
    }
    crud_cycle("orders", create, update)


def test_leads():
    crud_cycle(
        "leads",
        {"name": "Тестовый лид", "phone": "+7 (999) 123-45-67", "company": "ООО Лид-Тест", "city": "Москва"},
        # LeadPayload — phone & name required
        {"name": "Тестовый лид (upd)", "phone": "+7 (999) 123-45-68", "company": "ООО Лид-Тест", "city": "Москва", "status": "in_progress"},
    )


# ---------------- Dashboard regression ----------------
def test_dashboard():
    expected_keys = [
        "total_revenue", "total_cost", "total_margin", "profit", "tax_rate",
        "margin_percent", "active_orders", "delivered_orders", "total_orders",
        "unpaid_by_clients", "owed_to_carriers", "clients_count", "carriers_count",
        "leads_count", "top_clients", "debtors", "creditors", "status_breakdown",
        "available_months",
    ]
    for label, params in [
        ("GET /api/dashboard (no params)", None),
        ("GET /api/dashboard?period=all", "all"),
        ("GET /api/dashboard?period=2026-02", "2026-02"),
    ]:
        try:
            url = f"{API}/dashboard"
            if params is not None:
                url += f"?period={params}"
            r = requests.get(url, timeout=30)
            body = safe_json(r)
            ok_http = r.status_code == 200
            missing = [k for k in expected_keys if k not in (body or {})]
            ok_keys = ok_http and not missing
            # profit ≈ total_margin * 0.8
            profit_ok = True
            if ok_http and isinstance(body, dict):
                try:
                    margin = float(body.get("total_margin") or 0)
                    profit = float(body.get("profit") or 0)
                    expected = margin * 0.8
                    profit_ok = abs(profit - expected) < 1e-3
                except Exception:
                    profit_ok = False
            passed = ok_http and ok_keys and profit_ok
            details = f"status={r.status_code} missing={missing[:5]} margin={body.get('total_margin') if isinstance(body, dict) else None} profit={body.get('profit') if isinstance(body, dict) else None}"
            if isinstance(body, dict) and params == "2026-02":
                details += f" total_orders={body.get('total_orders')} available_months={body.get('available_months')}"
            record(label, passed, details)
        except Exception as e:
            record(label, False, f"exception: {e}")


# ---------------- Run ----------------
if __name__ == "__main__":
    print("\n=== Sheets sync ===")
    test_sheets_status()
    test_sheets_post()

    print("\n=== CRUD: clients ===")
    test_clients()
    print("\n=== CRUD: carriers ===")
    test_carriers()
    print("\n=== CRUD: orders ===")
    test_orders()
    print("\n=== CRUD: leads ===")
    test_leads()

    print("\n=== Dashboard ===")
    test_dashboard()

    # Summary
    total = len(results)
    passed = sum(1 for _, ok, _ in results if ok)
    failed = total - passed
    print("\n=========================================")
    print(f"TOTAL: {total}  PASSED: {passed}  FAILED: {failed}")
    print("=========================================")
    if failed:
        print("\nFAILED:")
        for label, ok, details in results:
            if not ok:
                print(f"  - {label}: {details[:300]}")
    sys.exit(0 if failed == 0 else 1)
