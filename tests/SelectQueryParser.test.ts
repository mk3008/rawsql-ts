import { describe, expect, test } from 'vitest';
import { DefaultFormatter } from '../src/models/DefaultFormatter';
import { SelectQueryParser } from '../src/parsers/SelectQueryParser';

const formatter = new DefaultFormatter();

describe('SelectQueryParser', () => {
    test.each([
        ["Simple SELECT",
            "select id, name from users",
            'select "id", "name" from "users"'],

        ["SELECT with alias",
            "select u.id as user_id, u.name as user_name from users u",
            'select "u"."id" as "user_id", "u"."name" as "user_name" from "users" as "u"'],

        ["SELECT ALL fields with wildcard",
            "select * from products",
            'select * from "products"'],

        ["SELECT with WHERE condition",
            "select id, name from users where active = TRUE",
            'select "id", "name" from "users" where "active" = true'],

        ["SELECT with multiple WHERE conditions",
            "select id, name from users where age >= 18 and status = 'active'",
            'select "id", "name" from "users" where "age" >= 18 and "status" = \'active\''],

        ["SELECT with ORDER BY",
            "select id, name from users order by name",
            'select "id", "name" from "users" order by "name"'],

        ["SELECT with ORDER BY DESC",
            "select id, name from users order by name desc",
            'select "id", "name" from "users" order by "name" desc'],

        ["SELECT with LIMIT",
            "select id, name from users limit 10",
            'select "id", "name" from "users" limit 10'],

        ["SELECT with LIMIT and OFFSET",
            "select id, name from users limit 10 offset 5",
            'select "id", "name" from "users" limit 10 offset 5'],

        ["SELECT with GROUP BY",
            "select department, count(*) as employee_count from employees group by department",
            'select "department", count(*) as "employee_count" from "employees" group by "department"'],

        ["SELECT with GROUP BY and HAVING",
            "select department, count(*) as employee_count from employees group by department having count(*) > 5",
            'select "department", count(*) as "employee_count" from "employees" group by "department" having count(*) > 5'],

        ["SELECT with JOIN",
            "select u.name, o.total from users u join orders o on u.id = o.user_id",
            'select "u"."name", "o"."total" from "users" as "u" join "orders" as "o" on "u"."id" = "o"."user_id"'],

        ["SELECT with multiple JOINs",
            "select u.name, o.id, p.name as product_name from users u join orders o on u.id = o.user_id join products p on o.product_id = p.id",
            'select "u"."name", "o"."id", "p"."name" as "product_name" from "users" as "u" join "orders" as "o" on "u"."id" = "o"."user_id" join "products" as "p" on "o"."product_id" = "p"."id"'],

        ["SELECT with LEFT JOIN",
            "select u.name, o.total from users u left join orders o on u.id = o.user_id",
            'select "u"."name", "o"."total" from "users" as "u" left join "orders" as "o" on "u"."id" = "o"."user_id"'],

        ["SELECT with subquery in FROM",
            "select avg_data.avg_price from (select category, avg(price) as avg_price from products group by category) as avg_data",
            'select "avg_data"."avg_price" from (select "category", avg("price") as "avg_price" from "products" group by "category") as "avg_data"'],

        ["SELECT with subquery in WHERE",
            "select id, name from users where id in (select user_id from premium_subscriptions)",
            'select "id", "name" from "users" where "id" in (select "user_id" from "premium_subscriptions")'],

        ["SELECT with DISTINCT",
            "select distinct category from products",
            'select distinct "category" from "products"'],

        ["SELECT with DISTINCT ON",
            "select distinct on (department) id, name, salary from employees order by department, salary desc",
            'select distinct on("department") "id", "name", "salary" from "employees" order by "department", "salary" desc'],

        ["SELECT with window functions",
            "select date, value, avg(value) over(order by date rows between 2 preceding and current row) as moving_avg from stocks",
            'select "date", "value", avg("value") over(order by "date" rows between 2 preceding and current row) as "moving_avg" from "stocks"'],

        ["SELECT with window clause",
            "select id, value, avg(value) over w from measurements window w as (order by id rows between 2 preceding and 2 following)",
            'select "id", "value", avg("value") over "w" from "measurements" window "w" as (order by "id" rows between 2 preceding and 2 following)'],

        ["SELECT with FOR UPDATE clause",
            "select id, stock from products where id = 123 for update",
            'select "id", "stock" from "products" where "id" = 123 for update'],

        ["SELECT with FOR SHARE clause",
            "select id, balance from accounts where user_id = 456 for share",
            'select "id", "balance" from "accounts" where "user_id" = 456 for share'],

        ["SELECT with all basic clauses combined",
            "select distinct u.id, u.name, count(o.id) as order_count " +
            "from users u " +
            "left join orders o on u.id = o.user_id " +
            "where u.active = true " +
            "group by u.id, u.name " +
            "having count(o.id) > 0 " +
            "order by order_count desc " +
            "limit 10",
            'select distinct "u"."id", "u"."name", count("o"."id") as "order_count" from "users" as "u" left join "orders" as "o" on "u"."id" = "o"."user_id" where "u"."active" = true group by "u"."id", "u"."name" having count("o"."id") > 0 order by "order_count" desc limit 10'],

        ["SELECT with NOT NULL check",
            "select id, name from users where email is not null",
            'select "id", "name" from "users" where "email" is not null'],

        ["SELECT with BETWEEN",
            "select product_name, price from products where price between 10 and 50",
            'select "product_name", "price" from "products" where "price" between 10 and 50'],

        ["SELECT with EXISTS subquery",
            "select id, name from customers where exists (select 1 from orders where orders.customer_id = customers.id)",
            'select "id", "name" from "customers" where exists (select 1 from "orders" where "orders"."customer_id" = "customers"."id")'],

        ["SELECT with WITH clause (CTE)",
            "WITH monthly_sales AS (SELECT DATE_TRUNC('month', order_date) AS month, SUM(amount) AS total FROM orders GROUP BY month) SELECT month, total FROM monthly_sales ORDER BY month",
            'with "monthly_sales" as(select date_trunc(\'month\', "order_date") as "month", sum("amount") as "total" from "orders" group by "month") select "month", "total" from "monthly_sales" order by "month"'],

        ["SELECT with multiple CTEs",
            "WITH customers_2023 AS (SELECT * FROM customers WHERE join_date >= '2023-01-01'), customer_orders AS (SELECT c.id, c.name, COUNT(o.id) AS order_count FROM customers_2023 c LEFT JOIN orders o ON c.id = o.customer_id GROUP BY c.id, c.name) SELECT * FROM customer_orders WHERE order_count > 0 ORDER BY order_count DESC",
            'with "customers_2023" as(select * from "customers" where "join_date" >= \'2023-01-01\'), "customer_orders" as(select "c"."id", "c"."name", count("o"."id") as "order_count" from "customers_2023" as "c" left join "orders" as "o" on "c"."id" = "o"."customer_id" group by "c"."id", "c"."name") select * from "customer_orders" where "order_count" > 0 order by "order_count" desc'],

        ["SELECT with recursive CTE",
            "WITH RECURSIVE employee_hierarchy AS (SELECT id, name, manager_id, 1 AS level FROM employees WHERE manager_id IS NULL UNION ALL SELECT e.id, e.name, e.manager_id, eh.level + 1 FROM employees e JOIN employee_hierarchy eh ON e.manager_id = eh.id) SELECT * FROM employee_hierarchy ORDER BY level, name",
            'with recursive "employee_hierarchy" as(select "id", "name", "manager_id", 1 as "level" from "employees" where "manager_id" is null union all select "e"."id", "e"."name", "e"."manager_id", "eh"."level" + 1 from "employees" as "e" join "employee_hierarchy" as "eh" on "e"."manager_id" = "eh"."id") select * from "employee_hierarchy" order by "level", "name"']

    ])('%s', (_, text, expected) => {
        // Parse the query
        const query = SelectQueryParser.parseFromText(text);
        // Format it back to SQL
        const sql = formatter.visit(query);
        // Verify it matches our expected output
        expect(sql).toBe(expected);
    });
});