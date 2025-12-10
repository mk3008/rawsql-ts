# Domain Specifications (Executable SQL Specs)

This folder stores SELECT-based specifications for domain behaviors.
Each file must contain a full executable SELECT statement.

Example:
```sql
SELECT
  m.*
FROM
  members m
WHERE
  m.member_status = @MemberStatus.ACTIVE
  AND m.contract_start_at <= :as_of
  AND (m.contract_end_at IS NULL OR :as_of <= m.contract_end_at);
```

AI uses these specifications to correctly interpret domain terms (e.g., “active member”).
