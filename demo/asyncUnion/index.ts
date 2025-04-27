import { SelectQueryParser, Formatter, SimpleSelectQuery } from 'rawsql-ts';

async function runDemo() {
    const queries = [
        'SELECT id, name FROM users',
        'SELECT id, title FROM posts',
        'SELECT id, product_name FROM products'
    ];

    const parsedQueries = await Promise.all(queries.map(query => SelectQueryParser.parseAsync(query))) as SimpleSelectQuery[];

    const combinedQuery = parsedQueries.reduce((acc, query) => acc.toUnionAll(query));

    const formatter = new Formatter();
    const formattedSql = formatter.format(combinedQuery);

    console.log(formattedSql);
}

runDemo().catch(console.error);
