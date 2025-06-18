-- Search TODOs with all related data
-- 
-- IMPORTANT: rawsql-ts Guidelines
-- 1. Avoid writing fixed search conditions - it weakens flexibility for arbitrary search requirements
-- 2. Do not use DSL syntax that won't work in SQL clients - it reduces maintainability
-- 3. Trust the library - rawsql-ts will inject conditions automatically
-- 4. Write only standard SQL that executes in any SQL client
-- 
-- Let rawsql-ts handle the complex parameter injection and dialect conversion.
-- This approach ensures clean, portable, and maintainable SQL code that is highly effective.
--
SELECT 
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
    -- Category information
    c.category_id,
    c.category_name,
    c.color,
    -- Comment count
    COALESCE(cc.comment_count, 0) as comment_count
FROM todo t
INNER JOIN "user" u ON t.user_id = u.user_id
INNER JOIN category c ON t.category_id = c.category_id
LEFT JOIN (
    SELECT 
        todo_id,
        COUNT(*) as comment_count
    FROM todo_comment
    GROUP BY todo_id
) cc ON t.todo_id = cc.todo_id
ORDER BY t.created_at DESC;
