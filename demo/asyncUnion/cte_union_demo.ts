import { SelectQueryParser, QueryBuilder, Formatter } from 'rawsql-ts';

async function runDemo() {
    const q1Promise = SelectQueryParser.parseAsync(`
    WITH active_users AS (
      SELECT id, name FROM users WHERE active = true
    )
    SELECT id, name FROM active_users
  `);

    const q2Promise = SelectQueryParser.parseAsync(`
    WITH inactive_users AS (
      SELECT id, name FROM users WHERE active = false
    )
    SELECT id, name FROM inactive_users
  `);

    const q3Promise = SelectQueryParser.parseAsync(`
    SELECT id, name FROM guests
  `);

    const [q1, q2, q3] = await Promise.all([q1Promise, q2Promise, q3Promise]);

    const unionQuery = QueryBuilder.buildBinaryQuery([q1, q2, q3], "union all");

    const sql = new Formatter().format(unionQuery);
    console.log(sql);
    // => with
    // "active_users" as (select "id", "name" from "users" where "active" = true),
    // "inactive_users" as (select "id", "name" from "users" where "active" = false)
    // select "id", "name" from "active_users"
    // union all select "id", "name" from "inactive_users"
    // union all select "id", "name" from "guests"
}

runDemo().catch(console.error);
