import unittest
from datetime import date
from lead_growth import paid_conversion, priority_leads, reactivation_list, LeadQualification

TODAY = date(2026, 11, 25)
START = date(2026, 11, 1)


class GrowthTest(unittest.TestCase):
    def test_priorities_count_only_fresh_verified_signals(self):
        leads = [
            {"id": "future", "signal_type": "quote_request", "signal_date": "2026-11-29", "heat_score": 90},
            {"id": "stale", "signal_type": "quote_request", "signal_date": "2026-09-25", "heat_score": 80},
            {"id": "fresh", "signal_type": "warehouse_supply", "signal_date": "2026-11-23", "heat_score": 75},
            {"id": "same", "heat_score": 90, "phone": "+375291000000"},
        ]
        self.assertEqual([lead["id"] for lead in priority_leads(leads, TODAY, 4)], ["fresh", "same", "future", "stale"])

    def test_cohort_reconciles_two_paid_shipments(self):
        leads = [
            {"client_id": "buyer", "codex_track": "marketplace", "created_at": "2026-11-03", "qualification": {"quote_requested": True}},
            {"client_id": "other", "codex_track": "lookalike", "created_at": "2026-11-20"},
            {"codex_track": "lookalike", "created_at": "2026-10-20"},
        ]
        clients = [{"id": "buyer", "name": 'ООО «Оптовик»'}, {"id": "other", "name": "Второй"}]
        base = {"client_id": "buyer", "client_rate": 1000, "carrier_rate": 740, "client_paid": True}
        orders = [
            {**base, "id": "1", "unload_date": "2026-11-08", "client_paid_date": "2026-11-14"},
            {**base, "id": "2", "client_id": "legacy-id", "client_name": "ОПТОВИК",
             "unload_date": "12.11.2026", "client_payments": [{"pp_date": "11.11.2026"}, {"pp_date": "2026-11-22"}]},
            {**base, "id": "1", "unload_date": "2026-11-08"},
            {**base, "id": "3", "unload_date": "2026-11-04", "client_paid": False},
            {**base, "id": "4", "unload_date": "2026-11-01"},
            {**base, "id": "5", "unload_date": "2026-11-22", "client_paid_date": "2026-11-27"},
            {**base, "id": "6", "client_id": "other", "unload_date": "2026-11-22"},
        ]
        market, b2b = paid_conversion(leads, orders, clients, start=START, today=TODAY)
        self.assertEqual((market["leads"], market["quote_requested"], market["first_paid"],
                          market["repeat_paid"], market["paid_orders"], market["margin"],
                          market["payment_days"], market["payment_dates"]), (1, 1, 1, 1, 2, 520, 8, 2))
        self.assertEqual((b2b["leads"], b2b["first_paid"], b2b["payment_days"]), (1, 1, None))

    def test_does_not_assign_ambiguous_companies(self):
        clients=[{"id": "a", "name": "ООО Ткани"}, {"id": "b", "name": "ИП Ткани"}]
        leads=[{"client_id": "a", "codex_track": "lookalike", "created_at": "2026-11-01"}]
        orders=[{"id": "1", "client_name": "Ткани", "unload_date": "2026-11-10", "client_paid": True}]
        _, b2b=paid_conversion(leads, orders, clients, start=START, today=TODAY)
        self.assertEqual(b2b["first_paid"], 0)

    def test_weekly_return_keeps_margin_and_removes_returned_client(self):
        clients=[{"id": "a", "name": "Первый"}, {"id": "b", "name": "Вернувшийся"}]
        tasks=[{"id": "a1", "client_id": "a", "last_order_day": "2026-10-20"},
               {"id": "b1", "client_id": "b", "last_order_day": "2026-10-01"}]
        orders=[
            {"client_id": "a", "unload_date": "2026-10-20", "client_rate": 900, "carrier_rate": 500,
             "route_from": "Минск", "route_to": "Москва"},
            {"client_id": "b", "unload_date": "2026-10-11", "client_rate": 500, "carrier_rate": 50},
        ]
        row, = reactivation_list(tasks, orders, clients, TODAY)
        self.assertEqual((row["task_id"], row["last_route"], row["margin_year"]), ("a1", "Минск → Москва", 400))

    def test_partial_qualification_keeps_fields_unset(self):
        edited=LeadQualification(next_shipment="2026-11-30", quote_requested=True)
        self.assertEqual(edited.model_dump(mode="json", exclude_unset=True),
                         {"next_shipment": "2026-11-30", "quote_requested": True})


if __name__ == "__main__":
    unittest.main()
