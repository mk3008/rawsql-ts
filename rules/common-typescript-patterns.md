# Common TypeScript Patterns

Essential TypeScript patterns for zosql.

## Type Safety Enforcement

### Prohibit @ts-nocheck and @ts-ignore
**Why**: Type suppression comments disable TypeScript's safety net, allowing runtime errors and reducing code reliability. They hide real type issues that should be resolved properly.
**How**: Remove all `@ts-nocheck` and `@ts-ignore` comments. Instead, fix the underlying type issues using proper type definitions, type guards, or refactoring.

### Use Strict Type Checking
**Why**: Strict mode catches common JavaScript pitfalls like undefined values, implicit any types, and null reference errors before they reach production.
**How**: 
```typescript
// tsconfig.json must include:
{
  "compilerOptions": {
    "strict": true,
    "noImplicitAny": true,
    "strictNullChecks": true
  }
}
```

## Interface vs Type Usage
```typescript
// Interfaces for object shapes
interface UserProfile { id: string; name: string; email: string; }

// Type aliases for unions, intersections, primitives
type Status = 'pending' | 'active' | 'inactive';
type ExtendedUser = User & { role: string };
```

## Type Safety Patterns
```typescript
// Use unknown instead of any, with type guards
function processData(data: unknown): string {
  if (isValidData(data)) return data.someProperty;
  throw new Error('Invalid data');
}

function isValidData(data: unknown): data is { someProperty: string } {
  return typeof data === 'object' && data !== null && 
         'someProperty' in data && typeof (data as any).someProperty === 'string';
}
```

## Additional Patterns
```typescript
// Readonly for immutability
interface Config { readonly apiUrl: string; readonly timeout: number; }
function processItems(items: ReadonlyArray<Item>): void { /* items.push() is compile error */ }

// Generic constraints
interface Repository<TEntity extends BaseEntity> {
  save(entity: TEntity): Promise<void>;
  findById(id: string): Promise<TEntity | null>;
}

// Utility types
type CreateUserData = Omit<User, 'id' | 'createdAt'>;
type UpdateUserData = Partial<Pick<User, 'name' | 'email'>>;

// Result pattern: See rules/architecture-principles.md for error handling patterns
```