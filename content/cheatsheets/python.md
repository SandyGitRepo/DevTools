---
title: Python
owner: DevToolkit maintainers
reviewed: 2026-10-04
version: Python 3.12
tags: [language, scripting, data]
sources: [docs.python.org/3.12]
---

Everyday Python 3.12 — the parts you reach for most.

## Strings

- f-strings format inline; `=` prints the expression too (handy for debugging)
- Strings are immutable: methods return new strings
- Use `str.join` instead of `+` in loops

```python
name, amount = "Asha", 125000.5
print(f"{name}: ₹{amount:,.2f}")       # Asha: ₹125,000.50
print(f"{amount=}")                     # amount=125000.5
" a,b ,c ".strip().split(",")           # ['a', 'b ', 'c']
"-".join(["2026", "10", "04"])          # '2026-10-04'
"loan_id".removeprefix("loan_")         # 'id'
```

## Loops

- `enumerate` gives index and value; `zip` walks lists in parallel
- `for … else` runs the `else` only if the loop did not `break`
- Use `range(start, stop, step)` — `stop` is excluded

```python
for i, city in enumerate(["Pune", "Delhi"], start=1):
    print(i, city)

for name, score in zip(["a", "b"], [90, 75]):
    print(name, score)

for n in range(10, 0, -3):
    print(n)                            # 10 7 4 1
```

## Functions

- Default values are evaluated once — never use a mutable default like `[]`
- `*args` collects positional, `**kwargs` keyword arguments
- Type hints document intent; they are not enforced at run time

```python
def emi(principal: float, annual_rate: float, months: int = 12) -> float:
    r = annual_rate / 12 / 100
    if r == 0:
        return principal / months
    f = (1 + r) ** months
    return principal * r * f / (f - 1)

def add_tag(item, tags=None):
    tags = [] if tags is None else tags
    tags.append(item)
    return tags

print(round(emi(500000, 8.5, 60), 2))   # 10258.27
```

## Classes

- `@dataclass` generates `__init__`, `__repr__` and `__eq__`
- `frozen=True` makes instances immutable (hashable)
- Prefer composition and small classes

```python
from dataclasses import dataclass, field

@dataclass(frozen=True)
class Loan:
    loan_id: str
    amount: float
    tags: tuple[str, ...] = field(default_factory=tuple)

    @property
    def is_large(self) -> bool:
        return self.amount >= 1_000_000

loan = Loan("LN-1", 1_500_000)
print(loan, loan.is_large)
```

## Exceptions

- Catch the narrowest exception you can handle
- `raise … from e` keeps the original cause in the traceback
- `finally` always runs; context managers (`with`) are usually cleaner

```python
def parse_amount(text: str) -> float:
    try:
        return float(text.replace(",", ""))
    except ValueError as e:
        raise ValueError(f"Not an amount: {text!r}") from e

try:
    parse_amount("12,5x")
except ValueError as err:
    print(err)
```

## Collections

- `dict.get(key, default)` avoids `KeyError`
- `collections.Counter` counts, `defaultdict` groups
- Sets remove duplicates and test membership in O(1)

```python
from collections import Counter, defaultdict

cities = ["Pune", "Delhi", "Pune"]
Counter(cities).most_common(1)          # [('Pune', 2)]

by_city = defaultdict(list)
for name, city in [("Asha", "Pune"), ("Ravi", "Delhi")]:
    by_city[city].append(name)

unique = sorted(set(cities))            # ['Delhi', 'Pune']
merged = {"a": 1} | {"b": 2}            # dict union (3.9+)
```

## Comprehensions

- Shorter and faster than building lists with `append`
- Add a condition at the end to filter
- Use a generator expression `( … )` for large data — it is lazy

```python
squares = [n * n for n in range(5)]                 # [0, 1, 4, 9, 16]
evens = [n for n in range(10) if n % 2 == 0]
lengths = {w: len(w) for w in ["emi", "loan"]}      # dict comprehension
total = sum(x * 2 for x in range(1_000_000))        # generator, no big list
```

## File I/O

- Always use `with` so files close even on errors
- Pass `encoding="utf-8"` explicitly
- `pathlib.Path` beats string paths

```python
from pathlib import Path
import csv, json

path = Path("data") / "loans.csv"
path.parent.mkdir(exist_ok=True)
path.write_text("id,amount\nLN-1,500000\n", encoding="utf-8")

with path.open(encoding="utf-8", newline="") as f:
    rows = list(csv.DictReader(f))

Path("loans.json").write_text(json.dumps(rows, indent=2), encoding="utf-8")
```

## venv

- One virtual environment per project keeps dependencies isolated
- Activate it before `pip install`; never commit the `.venv` folder
- `python -m` ensures you use the interpreter you expect

```bash
python -m venv .venv
source .venv/bin/activate        # Windows: .venv\Scripts\activate
python -m pip install --upgrade pip
deactivate
```

## pip

- Pin versions in `requirements.txt` for repeatable installs
- Point pip at the internal mirror with `--index-url` (or `pip.conf`)
- `pip list --outdated` shows what can be upgraded

```bash
python -m pip install "requests==2.32.3"
python -m pip freeze > requirements.txt
python -m pip install -r requirements.txt
python -m pip install --index-url https://nexus.internal/repository/pypi/simple requests
python -m pip list --outdated
```
