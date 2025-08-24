# Security Standards

TypeScript safety requirements for rawsql-ts library development.

## Core Principles
- Use TypeScript's type system as primary defense
- Validate inputs at API boundaries  
- Never execute dynamic code from external input

## TypeScript Safety (MANDATORY)

### Forbidden Patterns
```typescript
// NEVER: any type - use unknown with type guards
function processInput(data: any): string {  // FORBIDDEN
  return data.someProperty;
}

// CORRECT: unknown with validation
function processInput(data: unknown): string {
  if (isValidInput(data)) {
    return data.someProperty;
  }
  throw new Error('Invalid input data');
}

// NEVER: Dynamic code execution
eval('code');                           // FORBIDDEN
new Function('return userCode')();      // FORBIDDEN
setTimeout('userCode', 1000);          // FORBIDDEN

// NEVER: Dynamic imports with external input  
const module = await import(userInput); // FORBIDDEN
```

## Input Validation for Library APIs

```typescript
// Validate SQL strings at library boundaries
export function parseSQL(sql: unknown): SelectQuery {
  if (typeof sql !== 'string') {
    throw new TypeError('SQL input must be string');
  }
  if (sql.trim().length === 0) {
    throw new Error('SQL input cannot be empty');
  }
  return SelectQueryParser.parse(sql);
}

// Type guards for complex objects
function isValidConfig(config: unknown): config is LibraryConfig {
  return typeof config === 'object' && 
         config !== null &&
         typeof (config as any).option === 'boolean';
}

export function initialize(config: unknown): void {
  if (!isValidConfig(config)) {
    throw new TypeError('Invalid configuration object');
  }
  // Safe to use config here
}
```

## Error Handling Security

```typescript
// CORRECT: Safe error messages for library users
export function formatSQL(sql: string): string {
  try {
    const query = SelectQueryParser.parse(sql);
    return SqlFormatter.format(query);
  } catch (error) {
    // Don't expose internal parser details to library users
    throw new Error('Invalid SQL syntax provided');
  }
}

// CORRECT: Detailed logging for debugging (internal use)
function internalParse(sql: string): SelectQuery {
  try {
    return SelectQueryParser.parse(sql);
  } catch (error) {
    console.error('Parse error details:', {
      sql: sql.substring(0, 100), // Truncate for safety
      error: error.message
    });
    throw error;
  }
}
```