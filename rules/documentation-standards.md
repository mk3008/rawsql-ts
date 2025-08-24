# Documentation Standards

JSDoc documentation standards for TypeScript projects.

## Core Principles
- Document public APIs (80%+ coverage target)
- Write self-explanatory code, document complex logic
- Comments explain "why", code shows "what"

## JSDoc Patterns

### Classes
```typescript
/**
 * Manages user data and operations
 * 
 * @example
 * const userService = new UserService(repository);
 * const user = await userService.createUser({ name: 'John' });
 */
export class UserService {
  /**
   * @param repository - User data storage
   * @param logger - Optional logger instance
   */
  constructor(
    private readonly repository: UserRepository,
    private readonly logger?: Logger
  ) {}
}
```

### Methods
```typescript
/**
 * Creates a new user with unique email validation
 * 
 * @param userData - User information to create
 * @returns Created user with generated ID
 * @throws {ValidationError} Invalid user data
 * @throws {DuplicateError} Email already exists
 */
async createUser(userData: CreateUserData): Promise<User> {
  // Implementation
}
```

### Interfaces
```typescript
/**
 * User entity representation
 */
interface User {
  /** Unique identifier */
  id: string;
  /** User display name */
  name: string;
  /** Email address (must be unique) */
  email: string;
}
```

### Complex Functions
```typescript
/**
 * Parses SQL WITH clauses and builds dependency graph
 * 
 * @param sql - SQL query with WITH clauses
 * @returns Dependency graph for CTE execution order
 * @throws {ParseError} Invalid SQL syntax
 */
function buildCTEDependencyGraph(sql: string): DependencyGraph {
  // Complex implementation that needs explanation
}
```

## Documentation Requirements

### Public APIs
- All exported classes, interfaces, functions
- Constructor parameters
- Method parameters and return types
- Thrown exceptions

### Complex Logic
- Algorithm explanations
- Business rule implementations
- Performance considerations
- Edge case handling

### Examples
- Usage examples for complex APIs
- Integration examples
- Common patterns

## Best Practices
- Keep documentation up-to-date with code changes
- Use clear, concise language
- Include links to related documentation
- Document assumptions and constraints