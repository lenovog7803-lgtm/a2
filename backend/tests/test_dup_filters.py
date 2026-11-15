"""Поиск дублей: условия из _dup_filters должны ловить тот же номер и то же название в другом написании."""
import ast, re, pathlib

src = pathlib.Path(__file__).resolve().parents[1].joinpath("server.py").read_text(encoding="utf-8")
ns = {"re": re}
for node in ast.parse(src).body:   # берём только помощник, без запуска всего сервера
    if (isinstance(node, ast.Assign) and getattr(node.targets[0], "id", "").startswith("_DUP")) or \
       (isinstance(node, ast.FunctionDef) and node.name == "_dup_filters"):
        exec(compile(ast.Module([node], []), "server.py", "exec"), ns)
f = ns["_dup_filters"]


def hit(cond_list, field, value):
    return any(re.search(c[field]["$regex"], value, re.I if c[field].get("$options") else 0) for c in cond_list if field in c)


def test_phone_any_format():
    c = f(phone="+375 (29) 123-45-67")
    assert hit(c, "phone", "80291234567") and hit(c, "phone", "375291234567, +375 17 200-00-00")
    assert not hit(c, "phone", "+375 29 123-45-68")
    assert f(phone="123") == []


def test_name_ignores_legal_form_and_quotes():
    c = f(name='ООО «Альфа Транс»')
    assert hit(c, "name", "Альфа-Транс") and hit(c, "name", "альфа транс ООО") and hit(c, "company_name", 'ЧУП "Альфа Транс"')
    assert not hit(c, "name", "Альфа Транс Плюс") and not hit(c, "name", "Альфа")
    assert f(name="ИП") == []


def test_unp():
    assert hit(f(unp="191 234 567"), "unp", "191234567") and f(unp="12") == []
