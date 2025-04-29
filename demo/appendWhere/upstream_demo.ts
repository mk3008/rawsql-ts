import { SelectQueryParser, Formatter, SimpleSelectQuery } from 'rawsql-ts';

// Parse the base query with CTE and UNION
const sql = `
    WITH sales_transactions AS (
        SELECT
            transaction_id,
            customer_id,
            amount,
            transaction_date,
            'sales' AS source
        FROM sales_schema.transactions
        WHERE transaction_date >= CURRENT_DATE - INTERVAL '90 days'
    ),
    support_transactions AS (
        SELECT
            support_id AS transaction_id,
            user_id AS customer_id,
            fee AS amount,
            support_date AS transaction_date,
            'support' AS source
        FROM support_schema.support_fees
        WHERE support_date >= CURRENT_DATE - INTERVAL '90 days'
    )
    SELECT * FROM (
        SELECT *
        FROM sales_transactions
        UNION ALL
        SELECT *
        FROM support_transactions
    ) d
    ORDER BY transaction_date DESC`;

const query = SelectQueryParser.parse(sql) as SimpleSelectQuery;

// Append WHERE condition to the upstream queries
query.appendWhereExpr('amount', expr => `${expr} > 100`, { upstream: true });

const formatter = new Formatter();
const formattedSql = formatter.format(query);

console.log(formattedSql);

// Expected output:
// After:
//     with "sales_transactions" as (
//         select "transaction_id", "customer_id", "amount", "transaction_date", 'sales' as "source"
//         from "sales_schema"."transactions"
//         where "transaction_date" >= current_date - INTERVAL '90 days'
//             and "amount" > 100 // append
//     ),
//     "support_transactions" as (
//         select "support_id" as "transaction_id", "user_id" as "customer_id", "fee" as "amount", "support_date" as "transaction_date", 'support' as "source"
//         from "support_schema"."support_fees"
//         where "support_date" >= current_date - INTERVAL '90 days'
//             and "fee" > 100// append
//     )
//     select * from (
//         select *
//         from "sales_transactions"
//         union all
//         select * from
//         "support_transactions"
//     ) as "d"
//     order by "transaction_date" desc

// Execution instructions for running the TypeScript file using ts-node
// 1. Open a terminal in the project root directory.
// 2. Run the following command:
//    npx ts-node demo/appendWhere/upstream_demo.ts
