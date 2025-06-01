-- Find all todos with category information (PostgresJsonQueryBuilder compatible)
-- Used in: findByCriteria, buildSearchQuery
-- Note: WHERE clause is dynamically injected by SqlParamInjector based on search criteria
-- Note: This query is processed by PostgresJsonQueryBuilder for JSON aggregation

SELECT 
    t.todo_id, t.title, t.description, t.status, t.priority,
    t.created_at as todo_created_at, t.updated_at as todo_updated_at,
    c.category_id, c.name as category_name, c.description as category_description,
    c.color as category_color, c.created_at as category_created_at
FROM todo t
LEFT JOIN category c ON t.category_id = c.category_id
ORDER BY 
    CASE t.priority 
        WHEN 'high' THEN 1 
        WHEN 'medium' THEN 2 
        WHEN 'low' THEN 3 
    END,
    t.created_at DESC
