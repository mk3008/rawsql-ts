-- Find all todos with priority-based ordering
-- Used in: findByCriteria, buildSearchQuery
-- Note: WHERE clause is dynamically injected by SqlParamInjector based on search criteria

SELECT todo_id, title, description, status, priority, category_id, created_at, updated_at
FROM todo
ORDER BY 
    CASE priority 
        WHEN 'high' THEN 1 
        WHEN 'medium' THEN 2 
        WHEN 'low' THEN 3 
    END,
    created_at DESC
