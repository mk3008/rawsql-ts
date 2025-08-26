# Error Handling Rules

Specific error types and patterns for SQL operations, plus fallback restrictions.

**Note**: See `rules/error-messages.md` for user-friendly error message formatting guidelines.

## Fallback Logic Restrictions (CRITICAL)

**Fallback logic is PROHIBITED unless explicitly justified.**

### FORBIDDEN
```typescript
// Silent fallback - hides problems
const result = apiCall() || 'default';
if (!data) createFallback();
```

### REQUIRED - Explicit Justification
```typescript
if (!workspace.openedObjects?.length) {
  // FALLBACK JUSTIFICATION: User preference allows empty startup
  // Business: Support blank workspace users  
  // Risk: No data loss, manual file open available
  logger.warn('Using empty workspace per user preference');
  return;
}
```

### MANDATORY Documentation
Every fallback requires:
1. **FALLBACK JUSTIFICATION** comment
2. **Business requirement** explanation  
3. **Risk assessment**
4. **Scope limitation**
5. **User notification** if needed

### Review Rules  
- Missing justification = **automatic rejection**
- Fallbacks require business approval
- Must log with appropriate severity
- Track as technical debt for removal

## SQL Processing Error Types (MANDATORY)

### SQL Parsing Errors
**Why**: Specific error types enable proper error handling and user feedback in SQL processing flows
**How**: Use dedicated error classes for different SQL processing failure modes
```typescript
export class SqlParsingError extends Error {
  constructor(
    message: string,
    public readonly sql: string,
    public readonly position?: number,
    cause?: Error
  ) {
    super(message);
    this.name = 'SqlParsingError';
    this.cause = cause;
  }
}

export class CteCircularDependencyError extends Error {
  constructor(
    message: string,
    public readonly dependencies: string[]
  ) {
    super(message);
    this.name = 'CteCircularDependencyError';
  }
}

// Usage in SQL parsers
try {
  const query = SelectQueryParser.parse(sql);
  return { success: true, query };
} catch (error) {
  throw new SqlParsingError(
    `SQL parsing failed: ${error.message}`,
    sql,
    error.position,
    error
  );
}
```

### File Operation Errors
**Why**: File operations in SQL processing (workspace files, config) need specific error handling
**How**: Use FileOperationError for all file system operations in SQL context
```typescript
export class FileOperationError extends Error {
  constructor(
    message: string,
    public readonly operation: 'read' | 'write' | 'access' | 'mkdir',
    public readonly path: string,
    cause?: Error
  ) {
    super(message);
    this.name = 'FileOperationError';
    this.cause = cause;
  }
}

// Usage in file operations
export function loadSqlFile(filePath: string): SqlFileResult {
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    return { success: true, content };
  } catch (error) {
    throw new FileOperationError(
      `Failed to read SQL file: ${error.message}`,
      'read',
      filePath,
      error
    );
  }
}
```