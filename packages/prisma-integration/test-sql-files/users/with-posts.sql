SELECT 
    u.id as user_id,
    u.name as user_name,
    u.email as user_email,
    p.id as post_id,
    p.title as post_title,
    p.content as post_content
FROM users u
LEFT JOIN posts p ON u.id = p.user_id
WHERE u.active = true
