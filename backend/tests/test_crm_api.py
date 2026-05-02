"""Logistics CRM API tests — iteration 2 (extended models + period dashboard)"""
import os
import pytest
import requests

BASE_URL = os.environ.get("EXPO_PUBLIC_BACKEND_URL", "https://crm-design-preview.preview.emergentagent.com").rstrip("/")
API = f"{BASE_URL}/api"


@pytest.fixture(scope="module")
def s():
    sess = requests.Session()
    sess.headers.update({"Content-Type": "application/json"})
    return sess


# ===== Health / root =====
def test_root(s):
    r = s.get(f"{API}/")
    assert r.status_code == 200
    assert "message" in r.json()


# ===== Seed (9 orders: 7 Feb + 2 Jan) =====
def test_seed(s):
    r = s.post(f"{API}/seed")
    assert r.status_code == 200
    d = r.json()
    assert d["ok"] is True
    assert d["clients"] == 5 and d["carriers"] == 5 and d["orders"] == 9 and d["leads"] == 7


def test_seed_idempotent(s):
    r1 = s.post(f"{API}/seed").json()
    r2 = s.post(f"{API}/seed").json()
    assert r1 == r2


# ===== Dashboard — period=all =====
def test_dashboard_all(s):
    r = s.get(f"{API}/dashboard", params={"period": "all"})
    assert r.status_code == 200
    d = r.json()
    for k in ["period", "available_months", "total_revenue", "total_margin",
              "top_clients", "status_breakdown", "active_orders", "delivered_orders",
              "total_orders", "clients_count", "carriers_count", "leads_count"]:
        assert k in d, f"missing key {k}"
    assert d["period"] == "all"
    assert d["total_orders"] == 9
    assert d["clients_count"] == 5 and d["carriers_count"] == 5 and d["leads_count"] == 7
    sb = d["status_breakdown"]
    assert sb["new"] + sb["in_progress"] + sb["delivered"] + sb["cancelled"] == 9
    assert d["total_margin"] == d["total_revenue"] - d["total_cost"]
    # available_months should include 2026-02 and 2026-01
    assert "2026-02" in d["available_months"]
    assert "2026-01" in d["available_months"]


# ===== Dashboard — period=2026-02 (Feb 2026, 7 orders) =====
def test_dashboard_feb_2026(s):
    r = s.get(f"{API}/dashboard", params={"period": "2026-02"})
    assert r.status_code == 200
    d = r.json()
    assert d["period"] == "2026-02"
    assert d["total_orders"] == 7
    sb = d["status_breakdown"]
    assert sb["new"] + sb["in_progress"] + sb["delivered"] + sb["cancelled"] == 7


# ===== Dashboard — period=2026-01 (Jan 2026, 2 orders) =====
def test_dashboard_jan_2026(s):
    r = s.get(f"{API}/dashboard", params={"period": "2026-01"})
    assert r.status_code == 200
    d = r.json()
    assert d["period"] == "2026-01"
    assert d["total_orders"] == 2
    # Both Jan orders are delivered in seed
    assert d["status_breakdown"]["delivered"] == 2
    # Different revenue from Feb
    feb = s.get(f"{API}/dashboard", params={"period": "2026-02"}).json()
    assert d["total_revenue"] != feb["total_revenue"]


# ===== Dashboard — empty period =====
def test_dashboard_empty_period(s):
    r = s.get(f"{API}/dashboard", params={"period": "2099-12"})
    assert r.status_code == 200
    d = r.json()
    assert d["total_orders"] == 0
    assert d["total_revenue"] == 0


# ===== Clients — new fields persist =====
def test_clients_extended_fields(s):
    payload = {
        "name": "TEST_ClientExt", "contact_person": "Тест И.И.", "phone": "+7000",
        "email": "t@t.ru", "inn": "1111111111", "kpp": "111101001",
        "legal_address": "г. Москва, ул. Тест, 1",
        "bank_name": "ТестБанк", "bank_account": "40702810000000099999",
        "bank_bik": "044525000", "bank_corr_account": "30101810000000000000",
        "payment_terms": "10 дней", "cargo_types": "Тест-груз",
        "directions": "МСК-СПб", "notes": "TEST"
    }
    cr = s.post(f"{API}/clients", json=payload)
    assert cr.status_code == 200
    cid = cr.json()["id"]
    try:
        g = s.get(f"{API}/clients/{cid}").json()
        for k, v in payload.items():
            assert g[k] == v, f"client field {k} mismatch: {g[k]} != {v}"
        # update preserves all fields
        upd = {**payload, "bank_name": "ОбновлБанк", "directions": "ЦФО"}
        u = s.put(f"{API}/clients/{cid}", json=upd)
        assert u.status_code == 200
        g2 = s.get(f"{API}/clients/{cid}").json()
        assert g2["bank_name"] == "ОбновлБанк"
        assert g2["directions"] == "ЦФО"
        assert g2["bank_bik"] == "044525000"
    finally:
        s.delete(f"{API}/clients/{cid}")


def test_clients_seed_has_bank_fields(s):
    items = s.get(f"{API}/clients").json()
    # at least one seeded client has bank fields populated
    with_bank = [c for c in items if c.get("bank_bik") and c.get("bank_account")]
    assert len(with_bank) >= 3


# ===== Carriers — new fields persist =====
def test_carriers_extended_fields(s):
    payload = {
        "company_name": "TEST_CarrierExt", "driver_name": "Тестов Т.Т.",
        "phone": "+7900", "inn": "5050505050", "kpp": "505001001",
        "legal_address": "г. Тест, ул. Тестовая, 5",
        "bank_name": "ТестБанк", "bank_account": "40802810000000088888",
        "bank_bik": "044525111", "bank_corr_account": "30101810000000000111",
        "vehicle_type": "Реф", "plate": "T999TT77",
        "capacity_tons": 20, "capacity_m3": 86,
        "cargo_types": "Реф продукты", "regions": "ЦФО, СЗФО",
        "rating": 4.7, "notes": "TEST"
    }
    cr = s.post(f"{API}/carriers", json=payload)
    assert cr.status_code == 200
    cid = cr.json()["id"]
    try:
        g = s.get(f"{API}/carriers/{cid}").json()
        for k, v in payload.items():
            assert g[k] == v, f"carrier field {k} mismatch: {g[k]} != {v}"
        # update
        u = s.put(f"{API}/carriers/{cid}", json={**payload, "regions": "Россия", "rating": 5.0})
        assert u.status_code == 200
        g2 = s.get(f"{API}/carriers/{cid}").json()
        assert g2["regions"] == "Россия"
        assert g2["rating"] == 5.0
        assert g2["bank_bik"] == "044525111"
    finally:
        s.delete(f"{API}/carriers/{cid}")


def test_carriers_seed_has_bank_fields(s):
    items = s.get(f"{API}/carriers").json()
    with_bank = [c for c in items if c.get("bank_bik") and c.get("bank_account")]
    assert len(with_bank) >= 3


# ===== Orders — new vehicle/driver/exact-address fields =====
def test_orders_new_fields_persist(s):
    payload = {
        "order_number": "TEST_O_NEW",
        "client_name": "TEST_Client", "carrier_name": "TEST_Carrier",
        "route_from": "Москва", "route_to": "Сочи",
        "route_from_address": "г. Москва, Каширское ш., 23",
        "route_to_address": "г. Сочи, ул. Морская, 1",
        "load_date": "2026-02-20", "unload_date": "2026-02-22",
        "driver_name": "Тестов Иван", "driver_phone": "+7 (900) 000-00-00",
        "vehicle_type": "Тент", "vehicle_plate": "Т123ЕС77",
        "client_rate": 100000, "carrier_rate": 80000,
        "status": "new", "cargo": "Тест", "weight_tons": 5.5,
    }
    cr = s.post(f"{API}/orders", json=payload)
    assert cr.status_code == 200
    oid = cr.json()["id"]
    try:
        g = s.get(f"{API}/orders/{oid}").json()
        for k in ["route_from_address", "route_to_address", "driver_name",
                  "driver_phone", "vehicle_type", "vehicle_plate"]:
            assert g[k] == payload[k], f"order field {k} mismatch"
        # PUT partial — must preserve new fields
        u = s.put(f"{API}/orders/{oid}", json={"status": "in_progress"})
        assert u.status_code == 200
        g2 = s.get(f"{API}/orders/{oid}").json()
        assert g2["status"] == "in_progress"
        assert g2["route_from_address"] == payload["route_from_address"]
        assert g2["driver_name"] == payload["driver_name"]
        assert g2["vehicle_plate"] == payload["vehicle_plate"]
        # PUT update of new fields directly
        u2 = s.put(f"{API}/orders/{oid}", json={"driver_name": "Новый Водитель",
                                                "vehicle_plate": "Н999АА77"})
        assert u2.status_code == 200
        g3 = s.get(f"{API}/orders/{oid}").json()
        assert g3["driver_name"] == "Новый Водитель"
        assert g3["vehicle_plate"] == "Н999АА77"
        # untouched fields preserved
        assert g3["route_from_address"] == payload["route_from_address"]
    finally:
        s.delete(f"{API}/orders/{oid}")


def test_orders_seed_has_new_fields(s):
    orders = s.get(f"{API}/orders").json()
    # all seeded orders have route_from_address now
    with_addr = [o for o in orders if o.get("route_from_address")]
    assert len(with_addr) >= 9
    # vehicle/driver populated from carrier
    with_vehicle = [o for o in orders if o.get("vehicle_plate") and o.get("driver_name")]
    assert len(with_vehicle) >= 9


# ===== 404 errors =====
def test_404s(s):
    assert s.get(f"{API}/clients/nope").status_code == 404
    assert s.get(f"{API}/carriers/nope").status_code == 404
    assert s.get(f"{API}/orders/nope").status_code == 404
    assert s.get(f"{API}/leads/nope").status_code == 404


# ===== Leads regression =====
def test_leads_crud_regression(s):
    payload = {"name": "TEST_Lead", "phone": "+7999", "status": "new"}
    cr = s.post(f"{API}/leads", json=payload); assert cr.status_code == 200
    lid = cr.json()["id"]
    try:
        s.put(f"{API}/leads/{lid}", json={**payload, "status": "won"})
        assert s.get(f"{API}/leads/{lid}").json()["status"] == "won"
    finally:
        s.delete(f"{API}/leads/{lid}")
    assert s.get(f"{API}/leads/{lid}").status_code == 404
