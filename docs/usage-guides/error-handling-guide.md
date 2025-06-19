# Error Handling Usage Guide

This guide explains how to handle and troubleshoot errors when using RawSqlClient. The library provides enhanced error messages with specific, actionable information to help you quickly identify and resolve issues.

## Overview

RawSqlClient provides three main types of enhanced error messages:

1. **SqlFileNotFoundError** - When SQL files cannot be located
2. **JsonMappingError** - When JSON mapping files have issues  
3. **SqlExecutionError** - When database queries fail

Each error includes detailed context and actionable suggestions to help you resolve issues quickly.

## Common Error Scenarios and Solutions

### 1. SQL File Not Found (SqlFileNotFoundError)

**When this occurs:**
- The specified SQL file doesn't exist at the expected path
- Incorrect file path or filename
- Missing file extensions or wrong directory structure

**What you'll see:**
```
SQL file not found: 'users/profile.sql'
Searched in: /project/sql/users/profile.sql
Suggestions:
- Check if the file exists at the specified path
- Verify the sqlFilesPath configuration (currently: './sql')
- Ensure the file has the correct extension (.sql)
- Check if parent directories exist
```

**How to fix:**
1. **Check file existence**: Verify the SQL file exists at the specified path
2. **Verify configuration**: Ensure `sqlFilesPath` is correctly set in your RawSqlClient options
3. **Check file extension**: Make sure your file has the `.sql` extension
4. **Directory structure**: Ensure all parent directories exist

**Code example:**
```typescript
try {
  const result = await client.query('users/profile.sql');
} catch (error) {
  if (error instanceof SqlFileNotFoundError) {
    console.log('File not found:', error.filename);
    console.log('Searched in:', error.searchedPath);
    // Check your file path and try again
  }
}
```

### 2. JSON Mapping Issues (JsonMappingError)

**When this occurs:**
- JSON mapping file has invalid syntax
- Required properties are missing
- File cannot be read or parsed

**What you'll see:**
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

**How to fix:**
1. **Check file existence**: Ensure the JSON mapping file exists at the specified location
2. **Validate JSON syntax**: Use a JSON validator to check for syntax errors
3. **Verify structure**: Ensure the JSON file has the correct structure and all required fields
4. **Check file permissions**: Make sure the file is readable by the process

**Code example:**
```typescript
try {
  const result = await client.query('users/profile.sql');
} catch (error) {
  if (error instanceof JsonMappingError) {
    console.log('JSON mapping issue:', error.message);
    console.log('File:', error.filePath);
    // Fix the JSON mapping file and try again
  }
}
```

### 3. SQL Execution Errors (SqlExecutionError)

**When this occurs:**
- There is a syntax error in the SQL query
- Referenced tables or columns do not exist
- Incorrect parameter types or counts

**What you'll see:**
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

**How to fix:**
1. **Check SQL syntax**: Review the SQL query for syntax errors
2. **Verify database objects**: Ensure all tables and columns exist in the database
3. **Check parameter types**: Make sure the types of parameters match the expected types in the database
4. **Review error message**: Read the database error message for specific details on what went wrong

**Code example:**
```typescript
try {
  const result = await client.query('users/profile.sql');
} catch (error) {
  if (error instanceof SqlExecutionError) {
    console.log('SQL execution error:', error.message);
    console.log('SQL:', error.sql);
    console.log('Parameters:', error.parameters);
    // Fix the SQL query and try again
  }
}
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

## Best Practices for Error Handling

### 1. Always Use Try-Catch Blocks

```typescript
import { RawSqlClient, SqlFileNotFoundError, JsonMappingError, SqlExecutionError } from '@rawsql-ts/prisma-integration';

try {
  const result = await client.query('users/search.sql', { term: 'john' });
  return result;
} catch (error) {
  // Handle specific error types
  if (error instanceof SqlFileNotFoundError) {
    console.error('SQL file issue:', error.message);
  } else if (error instanceof JsonMappingError) {
    console.error('JSON mapping issue:', error.message);
  } else if (error instanceof SqlExecutionError) {
    console.error('Database execution issue:', error.message);
  } else {
    console.error('Unexpected error:', error);
  }
  
  throw error; // Re-throw if needed
}
```

### 2. Enable Debug Mode for Development

```typescript
const client = new RawSqlClient(prisma, {
  sqlFilesPath: './sql',
  debug: true // Enables detailed logging
});
```

### 3. Validate Configuration Early

```typescript
// Test your configuration on startup
const client = new RawSqlClient(prisma, {
  sqlFilesPath: './sql'
});

// Try a simple query to validate setup
try {
  await client.query('health-check.sql');
  console.log('✅ RawSqlClient configured correctly');
} catch (error) {
  console.error('❌ RawSqlClient configuration issue:', error.message);
  process.exit(1);
}
```

## Troubleshooting Checklist

- [ ] SQL files exist at the configured `sqlFilesPath`
- [ ] SQL files have the correct `.sql` extension
- [ ] JSON mapping files (if used) have valid JSON syntax
- [ ] Database connection is working
- [ ] Required database tables and columns exist
- [ ] Parameter types match database expectations
- [ ] File permissions allow reading SQL/JSON files

## Related Guides

- [RawSqlClient Usage Guide](./class-RawSqlClient-usage-guide.md) - Main client usage
- [Unified JSON Mapping Usage Guide](./unified-json-mapping-usage-guide.md) - JSON mapping configuration
- [SQL File Organization Guide](./sql-file-organization-guide.md) - Best practices for organizing SQL files