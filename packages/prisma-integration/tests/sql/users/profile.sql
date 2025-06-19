SELECT 
    u.id,
    u.name,
    u.email,
    p.title,
    p.bio
FROM users u
LEFT JOIN profiles p ON u.id = p.userId;