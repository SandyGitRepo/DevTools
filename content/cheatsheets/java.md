---
title: Java
owner: DevToolkit maintainers
reviewed: 2026-10-04
version: Java 21 (LTS)
tags: [language, jvm, backend]
sources: [docs.oracle.com/en/java/javase/21]
---

Modern Java 21 idioms — records, switch patterns, streams and text blocks.

## Records

- Immutable data carriers: constructor, accessors, `equals`, `hashCode`, `toString` generated
- Add validation in a compact constructor
- Accessors have no `get` prefix: `loan.amount()`

```java
public record Loan(String id, BigDecimal amount, int tenureMonths) {
    public Loan {
        if (amount.signum() <= 0) throw new IllegalArgumentException("amount must be positive");
    }
}

var loan = new Loan("LN-1", new BigDecimal("500000"), 60);
System.out.println(loan.amount());
```

## Switch and pattern matching

- Arrow-form `switch` has no fall-through and can return a value
- Pattern matching for `switch` (Java 21) tests types and binds variables
- `instanceof` binds a variable directly

```java
String label = switch (status) {
    case "ACTIVE", "RESTRUCTURED" -> "Open";
    case "CLOSED" -> "Closed";
    default -> "Unknown";
};

static String describe(Object o) {
    return switch (o) {
        case Integer i when i > 100 -> "large int " + i;
        case Integer i -> "int " + i;
        case String s -> "text " + s.length();
        case null -> "null";
        default -> "other";
    };
}
```

## Strings and text blocks

- Text blocks (`"""`) keep multi-line JSON/SQL readable
- `formatted()` is the instance version of `String.format`
- Use `isBlank()` / `strip()` (Unicode-aware) over `trim()`

```java
String sql = """
        SELECT id, amount
          FROM loans
         WHERE status = '%s'
        """.formatted("ACTIVE");

boolean empty = "  ".isBlank();          // true
String joined = String.join(",", List.of("a", "b"));
```

## Collections

- `List.of`, `Set.of`, `Map.of` create immutable collections
- `var` infers local variable types — keep the right side explicit
- Java 21 sequenced collections add `getFirst()` / `getLast()`

```java
var cities = List.of("Pune", "Delhi", "Chennai");
var limits = Map.of("SILVER", 50_000, "GOLD", 200_000);

var counts = new HashMap<String, Integer>();
counts.merge("Pune", 1, Integer::sum);

System.out.println(cities.getFirst() + " " + cities.getLast());
```

## Streams

- Lazy pipeline: source → intermediate ops → one terminal op
- `toList()` (Java 16+) returns an unmodifiable list
- `Collectors.groupingBy` builds maps of lists or aggregates

```java
record Txn(String city, BigDecimal amount) {}

List<Txn> txns = List.of(new Txn("Pune", BigDecimal.TEN), new Txn("Pune", BigDecimal.ONE));

Map<String, BigDecimal> totals = txns.stream()
        .collect(Collectors.groupingBy(Txn::city,
                 Collectors.reducing(BigDecimal.ZERO, Txn::amount, BigDecimal::add)));

List<String> big = txns.stream()
        .filter(t -> t.amount().compareTo(BigDecimal.ONE) > 0)
        .map(Txn::city)
        .toList();
```

## Optional

- Return `Optional` instead of `null` from lookups
- Prefer `map`, `orElse`, `orElseThrow` over `get()`
- Do not use `Optional` for fields or parameters

```java
Optional<Loan> find(String id) { return Optional.ofNullable(repo.get(id)); }

BigDecimal amount = find("LN-1")
        .map(Loan::amount)
        .orElse(BigDecimal.ZERO);

Loan loan = find("LN-2").orElseThrow(() -> new NoSuchElementException("LN-2"));
```

## Exceptions and resources

- try-with-resources closes anything `AutoCloseable`, even on failure
- Wrap low-level exceptions with context; keep the cause
- Never swallow exceptions silently

```java
try (var reader = Files.newBufferedReader(Path.of("loans.csv"), StandardCharsets.UTF_8)) {
    reader.lines().skip(1).forEach(System.out::println);
} catch (IOException e) {
    throw new UncheckedIOException("Could not read loans.csv", e);
}
```

## Money and dates

- Never use `double` for money — use `BigDecimal` with an explicit scale and rounding
- `java.time` is immutable and thread-safe; avoid `Date`/`Calendar`
- Store instants in UTC; convert to `Asia/Kolkata` for display

```java
BigDecimal emi = new BigDecimal("10258.2745").setScale(2, RoundingMode.HALF_EVEN);  // 10258.27

ZonedDateTime ist = Instant.now().atZone(ZoneId.of("Asia/Kolkata"));
LocalDate due = LocalDate.of(2026, 10, 4).plusMonths(1);
String iso = ist.format(DateTimeFormatter.ISO_OFFSET_DATE_TIME);
```

## Virtual threads

- Java 21 virtual threads make blocking I/O cheap — one thread per task is fine
- Use them for I/O-bound work, not CPU-bound loops
- Avoid `synchronized` blocks around blocking calls (they pin the carrier thread)

```java
try (var executor = Executors.newVirtualThreadPerTaskExecutor()) {
    List<Future<String>> results = ids.stream()
            .map(id -> executor.submit(() -> fetchStatus(id)))
            .toList();
}
```
