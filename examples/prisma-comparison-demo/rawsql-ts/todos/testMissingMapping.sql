-- Test SQL file without corresponding JSON mapping
-- This is used specifically for testing missing JSON mapping error handling
SELECT 
    t.todo_id,
    t.title,
    t.description,
    t.completed
FROM todo t
WHERE t.todo_id = :todo_id
LIMIT 1;
