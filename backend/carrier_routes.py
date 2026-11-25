"""Group active carriers using completed CRM orders, including imported legacy routes."""

from collections import defaultdict
import re

from lead_growth import company_name, day

AREAS = {
    "moscow": r"москв\w*|московск\w+\s+обл\w*|мо(?=\s*\(|\s|$)|томилино|подольск\w*|софрино|андреевское|видное|раменск\w*|химки|люберцы|балашиха|домодедово|электросталь|одинцово|коледино|чехов|мытищи|пушкино|щелково|красногорск|ногинск|солнечногорск",
    "spb": r"(?:санкт|сантк|сакнт)(?:[\s.\-]*петербур\w*)?|петербур\w*|спб|колпино|шушары|пушкин|парголово|всеволожск|ленинградск\w+\s+обл\w*",
    "ulyanovsk": r"ульяновск\w*",
    "smolensk": r"смоленск\w*|смоленская\s+обл\w*",
    "other_ru": r"тольятти|владимир|казан\w*|краснодар|сочи|брянск|калуга|рязань|тверь|воронеж|ростов|нижни\w*\s+новгород|иваново|сасово|великие[\s\-]+луки|екатеринбург|вологда|ярославль|самара|пенза|псков",
    "belarus": r"беларус\w*|минск\w*|мниск|минк|жодино|брест|витебск|гродно|гомель|могилев\w*|лида|молодечно|логойск|держинск|солигорск|новополоцк|полоцк|борисов|бобруйск|барановичи|пинск|береза|березовска|чисть|ганцевичи|кричев|колодищи|мачулищи|жлобин|ельск|ивацевичи|ивье|городея|городище|орша|мозырь|прилуки|пружаны|сморгонь|солигорск|слуцк|круговец[\s\-]+калинино|великий\s+камень|турец\s+бояр\w*|узда|черкасы|ляховичи",
}
AREA_PATTERNS = {key: re.compile(rf"(?<!\w)(?:{aliases})(?!\w)") for key, aliases in AREAS.items()}
COUNTRY_RU = re.compile(r"(?<!\w)(?:россия|российская федерация|рф)(?!\w)")
BODIES = {
    "curtain": r"тент\w*|штор\w*",
    "refrigerated": r"рефрижератор\w*|реф",
    "insulated": r"изотерм\w*|термобудка",
    "van": r"фургон\w*|будка|цельнометаллическ\w*|цмф",
    "flatbed": r"борт\w*|открытая\s+платформа",
    "container": r"контейнер\w*",
    "lowbed": r"трал\w*|низкорам\w*",
}
BODY_PATTERNS = {key: re.compile(rf"(?<!\w)(?:{aliases})(?!\w)") for key, aliases in BODIES.items()}
BODY_PRECEDENCE = ("refrigerated", "insulated", "curtain", "van", "flatbed", "container", "lowbed")


def normalize(value):
    return str(value or "").casefold().replace("ё", "е")


def locations(value):
    text = normalize(value)
    matches = sorted((match.start(), key) for key, pattern in AREA_PATTERNS.items() for match in pattern.finditer(text))
    has_ru_place = any(key != "belarus" for _, key in matches)
    if not has_ru_place:
        matches.extend((match.start(), "other_ru") for match in COUNTRY_RU.finditer(text))
        matches.sort()
    return [key for _, key in matches]


def route_groups(origin, destination):
    first, last = locations(origin), locations(destination)
    if not first and len(set(last)) >= 2:
        first = last[:1]
    if not last and len(set(first)) >= 2:
        last = first[-1:]
    groups = set(first + last)
    direction = None
    if first and last:
        left = "by" if first[0] == "belarus" else "ru"
        right = "by" if last[-1] == "belarus" else "ru"
        direction = {("by", "ru"): "by_to_ru", ("ru", "by"): "ru_to_by",
                     ("by", "by"): "within_by", ("ru", "ru"): "within_ru"}[(left, right)]
    if direction != "within_by":
        groups.discard("belarus")
    return sorted(groups), direction


def body_type(*values):
    for value in values:
        text = normalize(value)
        for key in BODY_PRECEDENCE:
            if BODY_PATTERNS[key].search(text):
                return key
    return None


def exact_name(value):
    return " ".join(re.findall(r"\w+", normalize(value)))


def carrier_route_history(carriers, orders):
    by_id = {carrier["id"]: carrier for carrier in carriers if carrier.get("id")}
    exact, loose = defaultdict(set), defaultdict(set)
    for cid, carrier in by_id.items():
        for value in (carrier.get("company_name"), carrier.get("name")):
            if value:
                key = exact_name(value)
                if key:
                    exact[key].add(cid)
                key = company_name(value)
                if len(key) >= 3:
                    loose[key].add(cid)
    history = defaultdict(list)
    seen = set()
    for order in orders:
        cid = order.get("carrier_id")
        if cid not in by_id:
            value = order.get("carrier_name")
            if not value:
                continue
            exact_key, loose_key = exact_name(value), company_name(value)
            matches = exact.get(exact_key) or loose.get(loose_key)
            if not matches or len(matches) != 1:
                continue
            cid = next(iter(matches))
        order_key = order.get("order_number") or order.get("id")
        if order_key:
            if (cid, order_key) in seen:
                continue
            seen.add((cid, order_key))
        groups, direction = route_groups(order.get("route_from"), order.get("route_to"))
        date = day(order.get("unload_date")) or day(order.get("load_date"))
        order_body = body_type(order.get("vehicle_type"), order.get("vehicle_info"))
        history[cid].append({
            "areas": groups, "direction": direction, "date": date.isoformat() if date else None,
            "body": order_body,
        })
    result = {}
    for cid, carrier in by_id.items():
        card_body = body_type(carrier.get("vehicle_type"))
        trips = history.get(cid, [])
        if trips or card_body:
            result[cid] = {"card_body": card_body, "trips": trips}
    return result
