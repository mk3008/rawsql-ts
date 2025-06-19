# Enhanced Error Messages

The RawSqlClient now provides significantly improved error messages to enhance the debugging experience. Each error type has been enhanced with specific, actionable information.

## Error Types

### SqlFileNotFoundError

Thrown when a SQL file cannot be found or read.

**Enhanced Information:**
- Exact filename that was not found
- Full path that was searched
- Actionable suggestions for resolution

**Example:**
```
SQL file not found: 'users/profile.sql'
Searched in: /project/sql/users/profile.sql
Suggestions:
- Check if the file exists at the specified path
- Verify the sqlFilesPath configuration (currently: './sql')
- Ensure the file has the correct extension (.sql)
- Check if parent directories exist
```

### JsonMappingError

Thrown when JSON mapping files have issues (missing, invalid syntax, or incorrect structure).

**Enhanced Information:**
- Specific filename and location
- Detailed description of the issue
- Expected JSON structure format
- Original error details when available

**Example:**
```
Invalid JSON mapping file: 'profile.json'
Location: /project/sql/profile.json
Issue: Invalid JSON syntax: Unexpected token } in JSON at position 45
Expected format:
{
  "resultFormat": "object" | "array",
  "rootAlias": "string",
  "columns": { "field": "column_alias" },
  "relationships": { ... }
}
```

### SqlExecutionError

Thrown when SQL query execution fails at the database level.

**Enhanced Information:**
- Complete SQL query that failed
- Parameters that were passed
- Actual database error message
- Debugging suggestions

**Example:**
```
SQL query execution failed
SQL: SELECT id, name, email FROM users WHERE id = $1
Parameters: [1]
Database Error: column "email" does not exist
Suggestions:
- Check if all referenced tables and columns exist
- Verify parameter types match expected database types
- Check SQL syntax for any typos or missing clauses
- Ensure parameter count matches placeholders in SQL
```

## Usage

These enhanced error types can be caught and handled specifically:

```typescript
import { RawSqlClient, SqlFileNotFoundError, JsonMappingError, SqlExecutionError } from '@msugiura/rawsql-prisma';

try {
  const result = await client.query('users/profile.sql');
} catch (error) {
  if (error instanceof SqlFileNotFoundError) {
    console.log(`SQL file issue: ${error.filename}`);
    console.log(`Searched at: ${error.searchedPath}`);
  } else if (error instanceof JsonMappingError) {
    console.log(`JSON mapping issue: ${error.issue}`);
    console.log(`File: ${error.filePath}`);
  } else if (error instanceof SqlExecutionError) {
    console.log(`Database error: ${error.databaseError}`);
    console.log(`SQL: ${error.sql}`);
    console.log(`Parameters: ${JSON.stringify(error.parameters)}`);
  }
}
```

## Debug Mode

When `debug: true` is enabled in RawSqlClientOptions, you'll see enhanced logging:

```
✅ Loaded SQL file: /project/sql/users/profile.sql
📝 Content preview: SELECT u.id, u.name, u.email FROM users u WHERE...
📊 File size: 245 characters
🔍 Executing SQL query...
📝 SQL: SELECT u.id, u.name, u.email FROM users u WHERE u.id = $1
📋 Parameters (1): [123]
```

These improvements significantly enhance the debugging experience and provide developers with the information they need to quickly identify and resolve issues.