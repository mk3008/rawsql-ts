-- Count todos matching search criteria
-- Used in: countByCriteria
-- Note: WHERE clause is dynamically injected by SqlParamInjector based on search criteria

SELECT COUNT(*) as total 
FROM todo
