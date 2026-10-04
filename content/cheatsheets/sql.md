---
title: SQL (Oracle + PostgreSQL)
owner: DevToolkit maintainers
reviewed: 2026-10-04
version: Oracle 19c/23ai · PostgreSQL 16
tags: [database, sql, oracle, postgres]
sources: [docs.oracle.com/en/database, postgresql.org/docs/16]
---

Side-by-side syntax for the two databases we use most. Snippets marked **Try it** open in the SQL formatter.

## Select and filter

- Filter early with `WHERE`; `HAVING` filters after grouping
- `NULL` never equals anything — use `IS NULL` / `IS NOT NULL`
- `BETWEEN` is inclusive at both ends

```sql try
SELECT c.customer_id, c.full_name, l.amount
  FROM customers c
  JOIN loans l ON l.customer_id = c.customer_id
 WHERE l.status IN ('ACTIVE', 'NPA')
   AND l.closed_on IS NULL
   AND l.disbursed_on BETWEEN DATE '2026-04-01' AND DATE '2027-03-31'
 ORDER BY l.amount DESC;
```

## Limit rows

- Oracle 12c+ and PostgreSQL both support `FETCH FIRST n ROWS ONLY`
- PostgreSQL also has `LIMIT n OFFSET m`
- Always `ORDER BY` before limiting, or the rows are arbitrary

```sql
-- Both databases
SELECT * FROM loans ORDER BY amount DESC FETCH FIRST 10 ROWS ONLY;

-- PostgreSQL
SELECT * FROM loans ORDER BY amount DESC LIMIT 10 OFFSET 20;

-- Oracle 11g and older
SELECT * FROM (SELECT l.* FROM loans l ORDER BY amount DESC) WHERE ROWNUM <= 10;
```

## Aggregates and grouping

- Every non-aggregated column in `SELECT` must be in `GROUP BY`
- `COUNT(*)` counts rows; `COUNT(col)` skips NULLs
- `FILTER` (PostgreSQL) or `CASE` (both) for conditional sums

```sql try
SELECT branch,
       COUNT(*)                                         AS loans,
       SUM(amount)                                      AS exposure,
       SUM(CASE WHEN status = 'NPA' THEN amount END)    AS npa_amount
  FROM loans
 GROUP BY branch
HAVING SUM(amount) > 10000000;
```

## Window functions

- Compute per-row values over a group without collapsing rows
- `ROW_NUMBER` for top-N per group; `LAG`/`LEAD` for previous/next
- Same syntax in Oracle and PostgreSQL

```sql
SELECT *
  FROM (SELECT l.*,
               ROW_NUMBER() OVER (PARTITION BY branch ORDER BY amount DESC) AS rn,
               SUM(amount)  OVER (PARTITION BY branch)                      AS branch_total
          FROM loans l) t
 WHERE rn <= 3;
```

## CTEs (WITH)

- Name sub-queries for readability; reference them like tables
- `WITH RECURSIVE` (PostgreSQL) / recursive `WITH` (Oracle 11gR2+) walks hierarchies
- Oracle also has `CONNECT BY` for hierarchies

```sql
WITH active AS (
    SELECT customer_id, SUM(amount) AS total
      FROM loans
     WHERE status = 'ACTIVE'
     GROUP BY customer_id
)
SELECT c.full_name, a.total
  FROM active a
  JOIN customers c ON c.customer_id = a.customer_id
 WHERE a.total > 1000000;
```

## Dates

- Oracle `DATE` includes time; truncate with `TRUNC`
- PostgreSQL: `date_trunc`, `now()`, intervals
- Use literals `DATE 'YYYY-MM-DD'` (both) to avoid NLS surprises

```sql
-- Oracle
SELECT TRUNC(SYSDATE) - 30, ADD_MONTHS(SYSDATE, 1), TO_CHAR(SYSDATE, 'DD-MON-YYYY HH24:MI') FROM dual;

-- PostgreSQL
SELECT current_date - 30, now() + INTERVAL '1 month', to_char(now(), 'DD-Mon-YYYY HH24:MI');
```

## NULL handling and strings

- `COALESCE` works in both; Oracle also has `NVL`
- Oracle treats `''` as `NULL`; PostgreSQL does not
- Concatenate with `||` in both

```sql
SELECT COALESCE(middle_name, '')                AS middle,
       first_name || ' ' || last_name          AS full_name,
       UPPER(TRIM(pan))                         AS pan
  FROM customers;
```

## Upsert

- Oracle: `MERGE`; PostgreSQL: `INSERT … ON CONFLICT`
- PostgreSQL needs a unique constraint on the conflict columns

```sql
-- Oracle
MERGE INTO customer_limits t
USING (SELECT 101 AS customer_id, 50000 AS daily FROM dual) s
   ON (t.customer_id = s.customer_id)
 WHEN MATCHED THEN UPDATE SET t.daily = s.daily
 WHEN NOT MATCHED THEN INSERT (customer_id, daily) VALUES (s.customer_id, s.daily);

-- PostgreSQL
INSERT INTO customer_limits (customer_id, daily) VALUES (101, 50000)
ON CONFLICT (customer_id) DO UPDATE SET daily = EXCLUDED.daily;
```

## Identity and sequences

- Both support identity columns (Oracle 12c+, PostgreSQL 10+)
- Prefer `GENERATED … AS IDENTITY` over manual sequences
- `RETURNING` gets the generated key

```sql
CREATE TABLE audit_events (
    id         BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    event_type VARCHAR(50) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- PostgreSQL
INSERT INTO audit_events (event_type) VALUES ('LOGIN') RETURNING id;
```

## Explain and indexes

- Read the plan before adding indexes
- Index columns used in `WHERE` and `JOIN`; put the most selective first
- Functions on a column (`UPPER(pan)`) need a function-based index

```sql
-- Oracle
EXPLAIN PLAN FOR SELECT * FROM loans WHERE customer_id = 101;
SELECT * FROM TABLE(DBMS_XPLAN.DISPLAY);

-- PostgreSQL
EXPLAIN (ANALYZE, BUFFERS) SELECT * FROM loans WHERE customer_id = 101;

CREATE INDEX ix_loans_customer ON loans (customer_id, status);
CREATE INDEX ix_customers_pan  ON customers (UPPER(pan));
```
