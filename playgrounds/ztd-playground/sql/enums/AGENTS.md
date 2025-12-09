# Domain Enums

Declare ENUM-like domain values using simple SQL `VALUES` syntax so fixtures and rewrites stay consistent.

Example:

VALUES
  (1, 'ACTIVE',  '有効会員'),
  (2, 'STOPPED', '退会中');

AI must reference these files instead of inventing magic numbers.
