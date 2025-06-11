-- Basic user list query
-- Fixed condition: only active users (business rule)
-- Dynamic conditions will be injected by rawsql-ts based on filter parameters
SELECT id, name, email, created_at
FROM users
WHERE active = true
