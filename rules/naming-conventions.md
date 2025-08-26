# Naming Conventions

TypeScript naming standards.

## Core Patterns
```typescript
// Interfaces/Types: PascalCase, no I prefix
interface User { id: string; name: string; }
type UserId = string;
type Status = 'pending' | 'active' | 'inactive';

// Classes: PascalCase, methods: camelCase, private: _prefix
class UserService {
  private _users: User[] = [];
  public getUser(id: UserId): User | undefined {
    return this._users.find(u => u.id === id);
  }
}
```

## Additional Patterns
```typescript
// Constants: UPPER_SNAKE_CASE, Enums: PascalCase
const MAX_RETRY_COUNT = 3;
enum LogLevel { DEBUG = 'DEBUG', INFO = 'INFO', WARN = 'WARN', ERROR = 'ERROR' }

// Variables: camelCase, Arrays: plural, Files: kebab-case
let currentUser: User;
const users: User[] = []; // plural for arrays
// Files: user-service.ts, UserProfile.tsx (React components)

// Type parameters: T, TEntity
interface Container<T> { value: T; }
interface Repository<TEntity extends BaseEntity> { save(entity: TEntity): Promise<void>; }

// Avoid: abbreviations, meaningless names, numbers
// Bad: u, data, temp, flag, user1
// Good: user, userData, previousValue, isEnabled, currentUser
```