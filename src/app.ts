import { DefaultFormatter } from './models/DefaultFormatter';
import { ValueParser } from './parsers/ValueParser';
import { SqlTokenizer } from './parsers/sqlTokenizer';

console.log('Hello world');

const tokenizer = new SqlTokenizer(`
    /*
    -- Retrieve a unified list of user information and post information

SELECT 
      u.user_id  -- User ID
    , u.name AS user_name  -- User name
    , NULL AS post_id  -- Post ID (not applicable to user information)
    , NULL AS post_title  -- Post title (not applicable to user information)
FROM users u

UNION ALL
-- Retrieve post information and unify it with user information

SELECT 
      NULL AS user_id  -- User ID (not applicable to post information)
    , NULL AS user_name  -- User name (not applicable to post information)
    , p.post_id  -- Post ID
    , p.title AS post_title  -- Post title
FROM posts p

union all
*/
-- Retrieve a unified list of user information and post information

SELECT 
    u.user_id,  -- User ID
    u.name AS user_name,  -- User name
    NULL AS post_id,  -- Post ID (not applicable to user information)
    NULL AS post_title  -- Post title (not applicable to user information)
FROM users u

UNION ALL
-- Retrieve post information and unify it with user information

SELECT 
    NULL AS user_id,  -- User ID (not applicable to post information)
    NULL AS user_name,  -- User name (not applicable to post information)
    p.post_id,  -- Post ID
    p.title AS post_title  -- Post title
FROM posts p;

    `);
const lexemes = tokenizer.readLexmes();

console.log(lexemes);

/*
const value = ValueParser.Parse(lexemes, 0);

console.log(value);

const formatter = new DefaultFormatter();
const sql = formatter.visit(value.value);

console.log(sql);
*/
