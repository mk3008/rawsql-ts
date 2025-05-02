import { SelectQueryParser, QueryBuilder, Formatter } from 'rawsql-ts';

async function runDemo() {
    const q1Promise = SelectQueryParser.parseAsync('SELECT id FROM users');
    const q2Promise = SelectQueryParser.parseAsync('SELECT id FROM admins');
    const q3Promise = SelectQueryParser.parseAsync('SELECT id FROM guests');

    const [q1, q2, q3] = await Promise.all([q1Promise, q2Promise, q3Promise]);

    const unionQuery = QueryBuilder.buildBinaryQuery([q1, q2, q3], "union all");
    const sql = new Formatter().format(unionQuery);
    console.log(sql);
    // => select "id" from "users" union select "id" from "admins" union select "id" from "guests"
}

runDemo().catch(console.error);