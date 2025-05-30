-- Find todo by ID with all related data (categories and comments)
-- Used in: findById
-- Note: WHERE clause for todo_id is dynamically injected by SqlParamInjector
-- Note: This query is processed by PostgresJsonQueryBuilder for JSON aggregation

SELECT 
    t.todo_id, t.title, t.description, t.status, t.priority,
    t.created_at as todo_created_at, t.updated_at as todo_updated_at,
    c.category_id, c.name as category_name, c.description as category_description,
    c.color as category_color, c.created_at as category_created_at,
    com.todo_comment_id, com.todo_id as comment_todo_id,
    com.content as comment_content, com.author_name as comment_author_name,
    com.created_at as comment_created_at
FROM todo t
LEFT JOIN category c ON t.category_id = c.category_id
LEFT JOIN todo_comment com ON t.todo_id = com.todo_id
ORDER BY com.created_at ASC
