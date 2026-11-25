import unittest

from carrier_routes import carrier_route_history, route_groups


class CarrierRoutesTest(unittest.TestCase):
    def test_old_and_new_route_formats(self):
        self.assertEqual(route_groups("Санкт", "Петербург - Минск"), (["spb"], "ru_to_by"))
        self.assertEqual(route_groups("Минск", "Москва (Томилино)"), (["moscow"], "by_to_ru"))
        self.assertEqual(route_groups("", "Ульяновск — Минск"), (["ulyanovsk"], "ru_to_by"))
        self.assertEqual(route_groups("Жодино", "Держинск"), (["belarus"], "within_by"))
        self.assertEqual(route_groups("Минск", "Смоленская обл."), (["smolensk"], "by_to_ru"))
        self.assertEqual(route_groups("Минск", "Казань"), (["other_ru"], "by_to_ru"))
        self.assertEqual(route_groups("Минск", ""), ([], None))

    def test_id_and_unique_legacy_name_count_each_order_once(self):
        carriers = [
            {"id": "a", "company_name": 'ООО «Транс-А»', "vehicle_type": "Тент"},
            {"id": "b", "company_name": "ИП Дубль"},
            {"id": "c", "company_name": "ООО Дубль"},
            {"id": "d", "company_name": "Без рейсов", "vehicle_type": "Изотерм"},
        ]
        first = {"carrier_id": "a", "carrier_name": "Дубль", "order_number": "15",
                 "route_from": "Смоленск", "route_to": "Минск", "unload_date": "18.11.2026",
                 "load_date": "2026-11-17", "vehicle_info": "РЕФ; 20 т"}
        last = {"carrier_id": "stale", "carrier_name": "Транс А", "order_number": "16",
                "route_from": "Минск", "route_to": "Видное", "load_date": "2026-11-20"}
        ambiguous = {**last, "carrier_name": "Дубль", "order_number": "17"}
        result = carrier_route_history(carriers, [first, {**first, "id": "duplicate"}, last, ambiguous])
        self.assertEqual(result, {
            "a": {"card_body": "curtain", "trips": [
                {"areas": ["smolensk"], "direction": "ru_to_by", "date": "2026-11-18", "body": "refrigerated"},
                {"areas": ["moscow"], "direction": "by_to_ru", "date": "2026-11-20", "body": None},
            ]},
            "d": {"card_body": "insulated", "trips": []},
        })
