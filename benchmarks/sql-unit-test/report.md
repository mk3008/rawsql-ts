# Customer summary benchmark

## Environment
- Node.js v22.14.0
- Platform win32 10.0.26100
- CPU count 16
- PostgreSQL container image `postgres:18-alpine`

## Measurement scope
- Each timed iteration measures from before `CustomerSummaryRepository.customerSummary()` is invoked through result verification, so migration/seeding (traditional) or fixture resolution (ZTD) is part of the duration.
- Docker/container startup time is excluded: the PostgreSQL container is started once before all measured iterations.
- The benchmark script manages concurrency with Node async workers rather than spawning Vitest worker threads, so Vitest worker overhead is not part of the measured durations.
- Measurement rows cover both `perTest` runs (dedicated `exclusiveConnection`) and `shared` runs (reused pg.Client) so connection overhead can be compared against fixture/query costs.
- `perTest` iterations open and close a dedicated client every time, while `shared` iterations keep the client alive across repetitions for lower connection churn.
- Each recorded duration sums the total runtime of all tests in that repetition; the tables below average these totals.

## Conditions
- Measured runs: `ts-node benchmarks/sql-unit-test/scripts/customer-summary-benchmark.ts` with 5 repetitions, segmented by tests of 300 and parallel worker counts of 1, 2, 4, 8.
- Each condition reports the total wall-clock time to run the configured number of tests per repetition; the repeated totals are what the tables below average.
- Each run reuses the same repository scenario from the Vitest suite so the benchmark times the exact code paths covered by the automated tests.
- ZTD-mode measurements pass `dangerousSqlPolicy=off` to suppress warnings from unparseable statements; this only reduces log noise and does not change the execution semantics or the measured costs.

## Measurements

- The tables below present the total time required to complete each configured test count per repetition, averaged across the repeated runs.
### Total time to complete 300 tests (averaged over 5 repetitions)

| Method | Connection | Tests | Parallel | Total Mean (ms) | Standard Error (ms) | StdDev (ms) |
| --- | --- | --- | --- | --- | --- | --- |
| ztd | perTest (exclusive) | 300 | 1 | 3285.79 | 32.20 | 72.00 |
| traditional | perTest (exclusive) | 300 | 1 | 14474.18 | 132.01 | 295.19 |
| ztd | shared (reused) | 300 | 1 | 763.07 | 16.43 | 36.74 |
| traditional | shared (reused) | 300 | 1 | 16617.03 | 497.62 | 1112.71 |

- Standard Error (ms) refers to the standard error of the total completion times across the repeated reps.

## Cost breakdown

- Stage measurements capture `connection`, `query`, `verify`, and `cleanup` durations; the `total` row reports the sum of those spans.
- Summary A and B aggregate across all repetitions, worker counts, and test sizes. Mean (ms) is the average stage duration per iteration, while % of total is computed as ratio-of-sums (sum(stage_ms) ÷ sum(total_ms)) over the same iteration set.
- These breakdowns keep the spotlight on comparable connection/query/cleanup work while leaving rewrite-specific instrumentation to dedicated microbenchmarks.

### Summary A: Mode-level stage composition

| Mode | Stage | Mean (ms) | % of total |
| --- | --- | --- | --- |
| ztd | connection | 3.34 | 34.0% |
| ztd | query | 3.23 | 64.4% |
| ztd | verify | 0.01 | 0.2% |
| ztd | cleanup | 0.16 | 1.5% |
| traditional | connection | 6.68 | 12.9% |
| traditional | query | 35.02 | 67.5% |
| traditional | verify | 0.01 | 0.0% |
| traditional | cleanup | 10.10 | 19.5% |

### Summary B: Connection profile stage mix

| Mode | Connection | Stage | Mean (ms) | % of total |
| --- | --- | --- | --- | --- |
| ztd | perTest (exclusive) | connection | 6.46 | 59.1% |
| ztd | perTest (exclusive) | query | 4.15 | 38.0% |
| ztd | perTest (exclusive) | cleanup | 0.32 | 2.9% |
| ztd | shared (reused) | connection | 0.23 | 8.9% |
| ztd | shared (reused) | query | 2.31 | 90.8% |
| ztd | shared (reused) | cleanup | 0.00 | 0.1% |
| traditional | perTest (exclusive) | connection | 6.65 | 13.8% |
| traditional | perTest (exclusive) | query | 31.86 | 66.1% |
| traditional | perTest (exclusive) | cleanup | 9.72 | 20.1% |
| traditional | shared (reused) | connection | 6.71 | 12.1% |
| traditional | shared (reused) | query | 38.18 | 68.9% |
| traditional | shared (reused) | cleanup | 10.49 | 18.9% |

## Appendix: Full cost breakdown (raw)

- The table below repeats the raw per-iteration rows for reference.

| Mode | Connection | Tests | Parallel | Stage | Mean (ms) | % of total |
| --- | --- | --- | --- | --- | --- | --- |
| ztd | perTest (exclusive) | 300 | 1 | connection | 6.46 | 59.1% |
| ztd | perTest (exclusive) | 300 | 1 | query | 4.15 | 38.0% |
| ztd | perTest (exclusive) | 300 | 1 | verify | 0.01 | 0.1% |
| ztd | perTest (exclusive) | 300 | 1 | cleanup | 0.32 | 2.9% |
| ztd | perTest (exclusive) | 300 | 1 | total | 10.94 | 100.0% |
| traditional | perTest (exclusive) | 300 | 1 | connection | 6.65 | 13.8% |
| traditional | perTest (exclusive) | 300 | 1 | query | 31.86 | 66.1% |
| traditional | perTest (exclusive) | 300 | 1 | verify | 0.01 | 0.0% |
| traditional | perTest (exclusive) | 300 | 1 | cleanup | 9.72 | 20.1% |
| traditional | perTest (exclusive) | 300 | 1 | total | 48.24 | 100.0% |
| ztd | shared (reused) | 300 | 1 | connection | 0.23 | 8.9% |
| ztd | shared (reused) | 300 | 1 | query | 2.31 | 90.8% |
| ztd | shared (reused) | 300 | 1 | verify | 0.01 | 0.2% |
| ztd | shared (reused) | 300 | 1 | cleanup | 0.00 | 0.1% |
| ztd | shared (reused) | 300 | 1 | total | 2.54 | 100.0% |
| traditional | shared (reused) | 300 | 1 | connection | 6.71 | 12.1% |
| traditional | shared (reused) | 300 | 1 | query | 38.18 | 68.9% |
| traditional | shared (reused) | 300 | 1 | verify | 0.01 | 0.0% |
| traditional | shared (reused) | 300 | 1 | cleanup | 10.49 | 18.9% |
| traditional | shared (reused) | 300 | 1 | total | 55.38 | 100.0% |

## SQL log details

### ZTD SQL (original query)
```sql
SELECT
  c.customer_id,
  c.customer_name,
  c.customer_email,
  COUNT(DISTINCT o.sales_order_id) AS total_orders,
  COALESCE(SUM(oi.quantity * oi.unit_price), 0) AS total_amount,
  MAX(o.sales_order_date) AS last_order_date
FROM customer c
LEFT JOIN sales_order o ON o.customer_id = c.customer_id
LEFT JOIN sales_order_item oi ON oi.sales_order_id = o.sales_order_id
GROUP BY c.customer_id, c.customer_name, c.customer_email
ORDER BY c.customer_id;
```

### ZTD SQL (rewritten)
```sql
with "public_customer" as (select 1::bigint as "customer_id", 'Alice'::text as "customer_name", 'alice@example.com'::text as "customer_email", '2025-12-01T08:00:00Z'::timestamp as "registered_at" union all select 2::bigint as "customer_id", 'Bob'::text as "customer_name", 'bob@example.com'::text as "customer_email", '2025-12-02T09:00:00Z'::timestamp as "registered_at" union all select 3::bigint as "customer_id", 'Cara'::text as "customer_name", 'cara@example.com'::text as "customer_email", '2025-12-03T10:00:00Z'::timestamp as "registered_at"), "public_sales_order" as (select 100::bigint as "sales_order_id", 1::bigint as "customer_id", '2025-12-04'::date as "sales_order_date", 2::int as "sales_order_status_code" union all select 101::bigint as "sales_order_id", 1::bigint as "customer_id", '2025-12-06'::date as "sales_order_date", 2::int as "sales_order_status_code" union all select 200::bigint as "sales_order_id", 2::bigint as "customer_id", '2025-12-05'::date as "sales_order_date", 2::int as "sales_order_status_code"), "public_sales_order_item" as (select 1001::bigint as "sales_order_item_id", 100::bigint as "sales_order_id", 10::bigint as "product_id", 2::int as "quantity", '25.00'::numeric as "unit_price" union all select 1002::bigint as "sales_order_item_id", 101::bigint as "sales_order_id", 11::bigint as "product_id", 1::int as "quantity", '75.00'::numeric as "unit_price" union all select 1003::bigint as "sales_order_item_id", 200::bigint as "sales_order_id", 12::bigint as "product_id", 3::int as "quantity", '5.00'::numeric as "unit_price") select "c"."customer_id", "c"."customer_name", "c"."customer_email", count(distinct "o"."sales_order_id") as "total_orders", coalesce(sum("oi"."quantity" * "oi"."unit_price"), 0) as "total_amount", max("o"."sales_order_date") as "last_order_date" from "public_customer" as "c" left join "public_sales_order" as "o" on "o"."customer_id" = "c"."customer_id" left join "public_sales_order_item" as "oi" on "oi"."sales_order_id" = "o"."sales_order_id" group by "c"."customer_id", "c"."customer_name", "c"."customer_email" order by "c"."customer_id"
```

### DDL definitions used by both modes

```sql
-- EC domain: customer, product, sales order, and sales order item for ZTD practice.
CREATE TABLE customer (
  customer_id bigint GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
  customer_name text NOT NULL,
  customer_email text NOT NULL,
  registered_at timestamp NOT NULL
);

CREATE TABLE product (
  product_id bigint GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
  product_name text NOT NULL,
  list_price numeric NOT NULL,
  product_category_id bigint
);

CREATE TABLE sales_order (
  sales_order_id bigint GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
  customer_id bigint NOT NULL REFERENCES customer (customer_id),
  sales_order_date date NOT NULL,
  sales_order_status_code int NOT NULL
);

CREATE TABLE sales_order_item (
  sales_order_item_id bigint GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
  sales_order_id bigint NOT NULL REFERENCES sales_order (sales_order_id),
  product_id bigint NOT NULL REFERENCES product (product_id),
  quantity int NOT NULL,
  unit_price numeric NOT NULL
);
```

### Traditional repository query (measured)
```sql
SELECT
  c.customer_id,
  c.customer_name,
  c.customer_email,
  COUNT(DISTINCT o.sales_order_id) AS total_orders,
  COALESCE(SUM(oi.quantity * oi.unit_price), 0) AS total_amount,
  MAX(o.sales_order_date) AS last_order_date
FROM customer c
LEFT JOIN sales_order o ON o.customer_id = c.customer_id
LEFT JOIN sales_order_item oi ON oi.sales_order_id = o.sales_order_id
GROUP BY c.customer_id, c.customer_name, c.customer_email
ORDER BY c.customer_id;
```

## Observations
- Parallel worker counts consistently increase the mean duration in both ZTD and traditional modes, and the perTest connection profile amplifies that growth because every worker opens and closes a dedicated pg.Client for each iteration.
- Shared connection profile measurements show a lower baseline, revealing how query/fixture work and database saturation become the primary drivers once the fixed connection cost is removed.
- The 100-repetition runs echo the same framing, meaning the contrast between the connection profiles persists even during sustained workloads.