import { describe, expect, test } from 'vitest';
import { SelectQueryParser } from "../src/parsers/SelectQueryParser";
import { DefaultFormatter } from '../src/models/DefaultFormatter';

describe('SelectQueryParser', () => {
    const formatter = new DefaultFormatter();
    test.each([
        ["Simple SELECT query",
            "select id, name from users",
            'select "id", "name" from "users"'],

        ["SELECT with WHERE clause",
            "select id, name from users where active = true",
            'select "id", "name" from "users" where "active" = true'],

        ["SELECT with ORDER BY clause",
            "select id, name from users order by name",
            'select "id", "name" from "users" order by "name"'],

        ["SELECT with WHERE and ORDER BY clauses",
            "select id, name from users where active = true order by name",
            'select "id", "name" from "users" where "active" = true order by "name"'],

        ["SELECT with GROUP BY clause",
            "select department, count(*) as count from employees group by department",
            'select "department", count(*) as "count" from "employees" group by "department"'],

        ["SELECT with GROUP BY and HAVING clauses",
            "select department, count(*) as count from employees group by department having count(*) > 5",
            'select "department", count(*) as "count" from "employees" group by "department" having count(*) > 5'],

        ["SELECT with LIMIT clause",
            "select id, name from users limit 10",
            'select "id", "name" from "users" limit 10'],

        ["SELECT with LIMIT and OFFSET clauses",
            "select id, name from users limit 10 offset 20",
            'select "id", "name" from "users" limit 10 offset 20'],

        ["SELECT with JOIN clause",
            "select u.id, u.name, o.id as order_id from users u join orders o on u.id = o.user_id",
            'select "u"."id", "u"."name", "o"."id" as "order_id" from "users" as "u" join "orders" as "o" on "u"."id" = "o"."user_id"'],

        ["SELECT with multiple JOINs",
            "select u.name, o.id as order_id, p.name as product_name from users u join orders o on u.id = o.user_id join products p on o.product_id = p.id",
            'select "u"."name", "o"."id" as "order_id", "p"."name" as "product_name" from "users" as "u" join "orders" as "o" on "u"."id" = "o"."user_id" join "products" as "p" on "o"."product_id" = "p"."id"'],

        ["SELECT with LEFT JOIN",
            "select u.name, o.id as order_id from users u left join orders o on u.id = o.user_id",
            'select "u"."name", "o"."id" as "order_id" from "users" as "u" left join "orders" as "o" on "u"."id" = "o"."user_id"'],

        ["SELECT with complex WHERE condition",
            "select id, name, status from orders where (status = 'shipped' or status = 'delivered') and total_amount > 100",
            'select "id", "name", "status" from "orders" where ("status" = \'shipped\' or "status" = \'delivered\') and "total_amount" > 100'],

        ["SELECT with DISTINCT",
            "select distinct category from products",
            'select distinct "category" from "products"'],

        ["SELECT with subquery in FROM",
            "select avg_price, count(*) from (select category, avg(price) as avg_price from products group by category) as category_avgs",
            'select "avg_price", count(*) from (select "category", avg("price") as "avg_price" from "products" group by "category") as "category_avgs"'],

        ["SELECT with window function",
            "select id, name, row_number() over (order by created_at) as row_num from users",
            'select "id", "name", row_number() over(order by "created_at") as "row_num" from "users"'],

        ["SELECT with window function and PARTITION BY",
            "select department, salary, rank() over (partition by department order by salary desc) as salary_rank from employees",
            'select "department", "salary", rank() over(partition by "department" order by "salary" desc) as "salary_rank" from "employees"'],

        ["SELECT with window function and frame specification",
            "select date, value, avg(value) over (order by date rows between 2 preceding and current row) as moving_avg from stocks",
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
            "select distinct p.id, p.name, c.name as category, p.price from products p join categories c on p.category_id = c.id where p.price > 50 group by p.id, p.name, c.name, p.price having count(*) > 0 order by p.price desc limit 20 offset 40",
            'select distinct "p"."id", "p"."name", "c"."name" as "category", "p"."price" from "products" as "p" join "categories" as "c" on "p"."category_id" = "c"."id" where "p"."price" > 50 group by "p"."id", "p"."name", "c"."name", "p"."price" having count(*) > 0 order by "p"."price" desc limit 20 offset 40'],

        ["SELECT with complex expressions",
            "select id, case when price > 100 then 'expensive' when price > 50 then 'moderate' else 'cheap' end as price_category from products",
            'select "id", case when "price" > 100 then \'expensive\' when "price" > 50 then \'moderate\' else \'cheap\' end as "price_category" from "products"'],

        ["SELECT with function expressions",
            "select id, upper(name) as name_upper, length(description) as desc_length from products",
            'select "id", upper("name") as "name_upper", length("description") as "desc_length" from "products"'],

        ["SELECT with math operations",
            "select id, price, quantity, price * quantity as total from order_items",
            'select "id", "price", "quantity", "price" * "quantity" as "total" from "order_items"'],

        ["SELECT with subquery in WHERE",
            "select id, name from products where category_id in (select id from categories where active = true)",
            'select "id", "name" from "products" where "category_id" in (select "id" from "categories" where "active" = true)'],

        ["SELECT with EXISTS subquery",
            "select id, name from customers where exists (select 1 from orders where orders.customer_id = customers.id)",
            'select "id", "name" from "customers" where exists (select 1 from "orders" where "orders"."customer_id" = "customers"."id")'],

    ])('%s', (_, text, expected) => {
        // Parse the query
        const query = SelectQueryParser.parseFromText(text);
        // Format it back to SQL
        const sql = formatter.visit(query);
        // Verify it matches our expected output
        expect(sql).toBe(expected);
    });
});