SELECT 
    id,
    name,
    email,
    created_at,
    updated_at
FROM users
WHERE active = true
