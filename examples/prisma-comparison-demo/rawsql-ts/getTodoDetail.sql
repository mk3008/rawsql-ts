-- Get TODO detail with all related data including comments
-- 
-- IMPORTANT: rawsql-ts Guidelines
-- 1. Avoid writing fixed search conditions - it weakens flexibility for arbitrary search requirements
-- 2. Do not use DSL syntax that won't work in SQL clients - it reduces maintainability
-- 3. Trust the library - rawsql-ts will inject conditions automatically
-- 4. Write only standard SQL that executes in any SQL client
-- 
-- Let rawsql-ts handle the complex parameter injection and dialect conversion.
-- This approach ensures clean, portable, and maintainable SQL code.
--
-- rawsql-ts will dynamically inject WHERE clauses, parameters, and other
-- conditions based on the filter options passed to the query method.
-- This is a key difference from other SQL libraries - be careful not to 
-- mix traditional parameterized query patterns with rawsql-ts!
--
-- Example: When filter: { todo_id: 1 } is passed, rawsql-ts will
-- automatically add "WHERE t.todo_id = $1" to this query.
--
SELECT 
    -- TODO information
    t.todo_id,
    t.title,
    t.description,
    t.completed,
    t.created_at,
    t.updated_at,
    -- User information
    u.user_id,
    u.user_name,
    u.email,
    u.created_at as user_created_at,
    -- Category information
    c.category_id,
    c.category_name,
    c.color,
    c.created_at as category_created_at,
    -- Comments information (flat structure)
    tc.comment_id,
    tc.comment_text,
    tc.created_at as comment_created_at,
    -- Comment user information
    cu.user_id as comment_user_id,
    cu.user_name as comment_user_name,
    cu.email as comment_user_email
FROM todo t
INNER JOIN "user" u ON t.user_id = u.user_id
INNER JOIN category c ON t.category_id = c.category_id
LEFT JOIN todo_comment tc ON t.todo_id = tc.todo_id
LEFT JOIN "user" cu ON tc.user_id = cu.user_id
ORDER BY tc.created_at ASC;
