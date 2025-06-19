-- Get user profile with todo statistics
SELECT 
    u.user_id,
    u.user_name,
    u.email,
    u.created_at,
    COUNT(t.todo_id) as total_todos,
    COUNT(CASE WHEN t.completed = true THEN 1 END) as completed_todos,
    COUNT(CASE WHEN t.completed = false THEN 1 END) as pending_todos
FROM "user" u
LEFT JOIN "todo" t ON u.user_id = t.user_id
GROUP BY u.user_id, u.user_name, u.email, u.created_at;
