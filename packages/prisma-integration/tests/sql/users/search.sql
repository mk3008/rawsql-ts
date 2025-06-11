-- User search with dynamic filtering support
-- Note: WHERE conditions will be dynamically injected by rawsql-ts based on filter parameters
SELECT u.id, u.name, u.email, u.created_at, u.active
FROM users u
