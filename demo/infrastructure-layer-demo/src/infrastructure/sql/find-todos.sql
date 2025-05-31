-- Find all todos with category information for table display
-- Used in: findByCriteria, buildSearchQuery
-- Note: WHERE clause is dynamically injected by SqlParamInjector based on search criteria

SELECT 
    t.todo_id, 
    t.title, 
    t.description, 
    t.status, 
    t.priority, 
    t.category_id, 
    t.created_at, 
    t.updated_at,
    c.name as category_name,
    c.color as category_color
FROM todo t
LEFT JOIN category c ON t.category_id = c.category_id
ORDER BY 
    CASE t.priority 
        WHEN 'high' THEN 1 
        WHEN 'medium' THEN 2 
        WHEN 'low' THEN 3 
    END,
    t.created_at DESC
