# Domain Enums

This folder stores ENUM-like domain definitions using simple SQL-like VALUES syntax.

Example:
```sql
VALUES
  (1, 'ACTIVE',  '有効会員'),
  (2, 'STOPPED', '退会中');
```

AI must reference these files instead of inventing magic numbers.
ZTD-cli may later generate TS constants, labels, or constraints from this folder.
