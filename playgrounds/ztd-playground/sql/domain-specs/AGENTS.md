# Domain Specifications (Executable SQL Specs)

Store SQL SELECT specifications that describe domain behaviors under `sql/domain-specs/`.
Each file must contain a complete executable SELECT statement.

Example:

SELECT
  m.*
FROM
  members m
WHERE
  m.member_status = @MemberStatus.ACTIVE
  AND m.contract_start_at <= :as_of
  AND (m.contract_end_at IS NULL OR :as_of <= m.contract_end_at);

AI uses these specifications to interpret domain terms (for example, "active member").
