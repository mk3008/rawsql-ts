-- Search users by name or email
SELECT 
    u.user_id,
    u.user_name,
    u.email,
    u.created_at
FROM "user" u
ORDER BY u.user_name;
