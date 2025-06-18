-- Posts with author information (JOIN query)
-- Fixed condition: only published posts (business rule)
-- Dynamic conditions will be injected by rawsql-ts based on filter parameters
SELECT 
    p.id,
    p.title,
    p.content,
    p.published,
    p.created_at,
    u.id as author_id,
    u.name as author_name,
    u.email as author_email
FROM posts p
INNER JOIN users u ON p.author_id = u.id
WHERE p.published = true
