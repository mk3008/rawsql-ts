SELECT 
    u.id,
    u.name,
    u.email,
    u.department_id
FROM users u
WHERE u.department_id = :departmentId
  AND u.age >= :minAge
  AND u.active = true
