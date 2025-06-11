-- Complex query with aggregation
-- Fixed condition: only active users (business rule)
-- Dynamic conditions will be injected by rawsql-ts based on filter parameters
SELECT 
    u.id,
    u.name,
    u.email,
    COUNT(p.id) as post_count,
    MAX(p.created_at) as latest_post_date
FROM users u
LEFT JOIN posts p ON u.id = p.author_id
WHERE u.active = true
GROUP BY u.id, u.name, u.email
