# TypeScript Integration Guide

This guide covers how to achieve full type safety when using `@rawsql-ts/prisma` with TypeScript.

## Type-Safe Query Execution

### Basic Type Safety

```typescript
import { RawSqlClient } from '@rawsql-ts/prisma-integration';

// Define your domain model interfaces
interface User {
  id: number;
  name: string;
  email: string;
  createdAt: Date;
  isActive: boolean;
}

interface UserProfile {
  id: number;
  name: string;
  email: string;
  profile: {
    title: string;
    bio: string;
    avatar?: string;
  };
  posts: Array<{
    id: number;
    title: string;
    publishedAt: Date;
    commentCount: number;
  }>;
}

const client = new RawSqlClient(prisma, { sqlFilesPath: './sql' });

// Type-safe single result queries
const user: User = await client.queryOne<User>('users/get-by-id.sql', { id: 123 });

// Type-safe multiple result queries
const users: User[] = await client.queryMany<User>('users/list-active.sql');

// Complex nested structures
const profile: UserProfile = await client.queryOne<UserProfile>(
  'users/get-profile.sql', 
  { userId: 123 }
);

// TypeScript enforces the return types
console.log(user.name);              // ✅ string
console.log(users[0].isActive);      // ✅ boolean
console.log(profile.posts[0].title); // ✅ string
console.log(user.invalidProperty);   // ❌ TypeScript error
```

### Parameter Type Safety

```typescript
// Define parameter interfaces for your queries
interface GetUserParams {
  userId: number;
}

interface SearchUsersParams {
  nameFilter?: string;
  emailFilter?: string;
  isActive?: boolean;
  createdAfter?: Date;
  limit?: number;
}

// Use satisfies operator for parameter validation
const getUserParams: GetUserParams = {
  userId: 123
};

const searchParams: SearchUsersParams = {
  nameFilter: 'john',
  isActive: true,
  limit: 10
};

// Type-safe parameter passing
const user = await client.queryOne<User>('users/get-by-id.sql', getUserParams);
const searchResults = await client.queryMany<User>('users/search.sql', searchParams);

// TypeScript catches parameter errors
const invalidParams = {
  userId: "not-a-number",  // ❌ TypeScript error
  unknownParam: true       // ❌ TypeScript error
};
```

## Advanced Type Patterns

### Generic Repository Pattern

```typescript
// Generic repository base class
abstract class BaseRepository<TEntity, TKey = number> {
  constructor(protected rawSql: RawSqlClient) {}

  abstract getById(id: TKey): Promise<TEntity | null>;
  abstract getAll(): Promise<TEntity[]>;
  abstract search(criteria: any): Promise<TEntity[]>;
}

// Concrete repository implementations
class UserRepository extends BaseRepository<User, number> {
  async getById(id: number): Promise<User | null> {
    const users = await this.rawSql.queryMany<User>('users/get-by-id.sql', { id });
    return users[0] || null;
  }

  async getAll(): Promise<User[]> {
    return this.rawSql.queryMany<User>('users/list-all.sql');
  }

  async search(criteria: UserSearchCriteria): Promise<User[]> {
    return this.rawSql.queryMany<User>('users/search.sql', criteria);
  }

  // User-specific methods with full type safety
  async getProfile(userId: number): Promise<UserProfile | null> {
    return this.rawSql.queryOne<UserProfile>('users/get-profile.sql', { userId });
  }

  async getActiveUsers(): Promise<User[]> {
    return this.rawSql.queryMany<User>('users/list-active.sql');
  }
}

class OrderRepository extends BaseRepository<Order, string> {
  async getById(id: string): Promise<Order | null> {
    const orders = await this.rawSql.queryMany<Order>('orders/get-by-id.sql', { id });
    return orders[0] || null;
  }

  async getAll(): Promise<Order[]> {
    return this.rawSql.queryMany<Order>('orders/list-all.sql');
  }

  async search(criteria: OrderSearchCriteria): Promise<Order[]> {
    return this.rawSql.queryMany<Order>('orders/search.sql', criteria);
  }
}
```

### Utility Types for SQL Results

```typescript
// Utility types for working with SQL results
type SqlResult<T> = T[];
type SqlSingleResult<T> = T;
type SqlOptionalResult<T> = T | null;

// Helper type for pagination results
interface PaginatedResult<T> {
  data: T[];
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
}

// Generic paginated query method
class PaginatedRepository {
  constructor(private rawSql: RawSqlClient) {}

  async getPaginated<T>(
    sqlFile: string,
    params: any,
    page: number = 1,
    pageSize: number = 20
  ): Promise<PaginatedResult<T>> {
    const offset = (page - 1) * pageSize;
    
    const [data, countResult] = await Promise.all([
      this.rawSql.queryMany<T>(sqlFile, {
        ...params,
        limit: pageSize,
        offset
      }),
      this.rawSql.queryOne<{ count: number }>(`${sqlFile.replace('.sql', '-count.sql')}`, params)
    ]);

    const total = countResult.count;
    const totalPages = Math.ceil(total / pageSize);

    return {
      data,
      pagination: {
        page,
        pageSize,
        total,
        totalPages
      }
    };
  }
}
```

### Type Guards and Validation

```typescript
// Type guards for runtime validation
function isUser(obj: any): obj is User {
  return obj &&
    typeof obj.id === 'number' &&
    typeof obj.name === 'string' &&
    typeof obj.email === 'string' &&
    obj.createdAt instanceof Date &&
    typeof obj.isActive === 'boolean';
}

function isUserProfile(obj: any): obj is UserProfile {
  return obj &&
    isUser(obj) &&
    obj.profile &&
    typeof obj.profile.title === 'string' &&
    typeof obj.profile.bio === 'string' &&
    Array.isArray(obj.posts);
}

// Safe query execution with validation
class SafeUserRepository {
  constructor(private rawSql: RawSqlClient) {}

  async getUser(id: number): Promise<User | null> {
    const result = await this.rawSql.queryOne('users/get-by-id.sql', { id });
    
    if (!result) return null;
    
    if (!isUser(result)) {
      throw new Error('Invalid user data structure returned from database');
    }
    
    return result;
  }

  async getUserProfile(userId: number): Promise<UserProfile | null> {
    const result = await this.rawSql.queryOne('users/get-profile.sql', { userId });
    
    if (!result) return null;
    
    if (!isUserProfile(result)) {
      throw new Error('Invalid user profile data structure returned from database');
    }
    
    return result;
  }
}
```

## Integration with Prisma Types

### Extending Prisma Generated Types

```typescript
import { User as PrismaUser, Profile as PrismaProfile } from '@prisma/client';

// Extend Prisma types for SQL results
interface UserWithProfile extends PrismaUser {
  profile?: PrismaProfile & {
    // Additional computed fields from SQL
    postCount: number;
    lastLoginAt?: Date;
  };
}

interface EnhancedUser extends PrismaUser {
  // Aggregated data from SQL queries
  totalPosts: number;
  totalComments: number;
  avgRating: number;
  
  // Nested relationships
  recentPosts: Array<{
    id: number;
    title: string;
    publishedAt: Date;
  }>;
}

// Use enhanced types with RawSqlClient
class EnhancedUserRepository {
  constructor(private rawSql: RawSqlClient) {}

  async getUserWithProfile(id: number): Promise<UserWithProfile | null> {
    return this.rawSql.queryOne<UserWithProfile>('users/get-with-profile.sql', { id });
  }

  async getEnhancedUser(id: number): Promise<EnhancedUser | null> {
    return this.rawSql.queryOne<EnhancedUser>('users/get-enhanced.sql', { id });
  }
}
```

### Type-Safe Query Building

```typescript
// Create strongly-typed query builders
interface QueryBuilder<T> {
  select(fields: (keyof T)[]): QueryBuilder<T>;
  where(conditions: Partial<T>): QueryBuilder<T>;
  orderBy(field: keyof T, direction: 'asc' | 'desc'): QueryBuilder<T>;
  limit(count: number): QueryBuilder<T>;
  build(): Promise<T[]>;
}

class TypedQueryBuilder<T> implements QueryBuilder<T> {
  private conditions: Partial<T> = {};
  private selectedFields: (keyof T)[] = [];
  private orderField?: keyof T;
  private orderDirection: 'asc' | 'desc' = 'asc';
  private limitCount?: number;

  constructor(
    private rawSql: RawSqlClient,
    private sqlFile: string
  ) {}

  select(fields: (keyof T)[]): QueryBuilder<T> {
    this.selectedFields = fields;
    return this;
  }

  where(conditions: Partial<T>): QueryBuilder<T> {
    this.conditions = { ...this.conditions, ...conditions };
    return this;
  }

  orderBy(field: keyof T, direction: 'asc' | 'desc'): QueryBuilder<T> {
    this.orderField = field;
    this.orderDirection = direction;
    return this;
  }

  limit(count: number): QueryBuilder<T> {
    this.limitCount = count;
    return this;
  }

  async build(): Promise<T[]> {
    const params = {
      ...this.conditions,
      _selectedFields: this.selectedFields,
      _orderBy: this.orderField ? `${String(this.orderField)} ${this.orderDirection}` : undefined,
      _limit: this.limitCount
    };

    return this.rawSql.queryMany<T>(this.sqlFile, params);
  }
}

// Usage with full type safety
const userQuery = new TypedQueryBuilder<User>(rawSql, 'users/flexible-search.sql');

const activeUsers = await userQuery
  .select(['id', 'name', 'email'])           // ✅ Only valid User fields
  .where({ isActive: true })                // ✅ Type-checked conditions
  .orderBy('createdAt', 'desc')             // ✅ Type-checked field name
  .limit(10)
  .build();
```

## Error Handling with Types

### Typed Error Responses

```typescript
// Define error types
interface SqlError {
  code: string;
  message: string;
  details?: any;
}

interface ValidationError {
  field: string;
  message: string;
  receivedValue: any;
}

// Result wrapper types
type QueryResult<T> = {
  success: true;
  data: T;
} | {
  success: false;
  error: SqlError;
  validationErrors?: ValidationError[];
};

// Safe query execution wrapper
class SafeQueryExecutor {
  constructor(private rawSql: RawSqlClient) {}

  async safeQueryOne<T>(sqlFile: string, params: any): Promise<QueryResult<T | null>> {
    try {
      const result = await this.rawSql.queryOne<T>(sqlFile, params);
      return {
        success: true,
        data: result
      };
    } catch (error) {
      return {
        success: false,
        error: {
          code: 'QUERY_EXECUTION_ERROR',
          message: error.message,
          details: { sqlFile, params }
        }
      };
    }
  }

  async safeQueryMany<T>(sqlFile: string, params: any): Promise<QueryResult<T[]>> {
    try {
      const result = await this.rawSql.queryMany<T>(sqlFile, params);
      return {
        success: true,
        data: result
      };
    } catch (error) {
      return {
        success: false,
        error: {
          code: 'QUERY_EXECUTION_ERROR',
          message: error.message,
          details: { sqlFile, params }
        }
      };
    }
  }
}

// Usage with type-safe error handling
const executor = new SafeQueryExecutor(rawSql);

const result = await executor.safeQueryOne<User>('users/get-by-id.sql', { id: 123 });

if (result.success) {
  // TypeScript knows result.data is User | null
  console.log(result.data?.name);
} else {
  // TypeScript knows result.error is SqlError
  console.error('Query failed:', result.error.message);
}
```

## Testing with Types

### Mock Types for Testing

```typescript
// Mock factory for generating test data
class MockFactory {
  static createUser(overrides: Partial<User> = {}): User {
    return {
      id: 1,
      name: 'Test User',
      email: 'test@example.com',
      createdAt: new Date(),
      isActive: true,
      ...overrides
    };
  }

  static createUserProfile(overrides: Partial<UserProfile> = {}): UserProfile {
    return {
      ...this.createUser(),
      profile: {
        title: 'Test Title',
        bio: 'Test bio',
        avatar: undefined
      },
      posts: [],
      ...overrides
    };
  }

  static createUsers(count: number, overrides: Partial<User> = {}): User[] {
    return Array.from({ length: count }, (_, index) =>
      this.createUser({
        id: index + 1,
        name: `Test User ${index + 1}`,
        email: `test${index + 1}@example.com`,
        ...overrides
      })
    );
  }
}

// Type-safe testing
describe('UserRepository', () => {
  let repository: UserRepository;
  let mockRawSql: jest.Mocked<RawSqlClient>;

  beforeEach(() => {
    mockRawSql = {
      queryOne: jest.fn(),
      queryMany: jest.fn(),
      query: jest.fn()
    } as any;

    repository = new UserRepository(mockRawSql);
  });

  it('should return typed user data', async () => {
    const mockUser = MockFactory.createUser({ id: 123, name: 'John Doe' });
    mockRawSql.queryMany.mockResolvedValue([mockUser]);

    const result = await repository.getById(123);

    expect(result).toEqual(mockUser);
    expect(mockRawSql.queryMany).toHaveBeenCalledWith('users/get-by-id.sql', { id: 123 });
    
    // TypeScript ensures result is properly typed
    expect(result?.name).toBe('John Doe');  // ✅ Type-safe access
  });

  it('should return typed user profile', async () => {
    const mockProfile = MockFactory.createUserProfile({
      id: 123,
      profile: { title: 'Engineer', bio: 'Software developer' }
    });
    
    mockRawSql.queryOne.mockResolvedValue(mockProfile);

    const result = await repository.getProfile(123);

    expect(result?.profile.title).toBe('Engineer');  // ✅ Type-safe nested access
    expect(result?.posts).toBeInstanceOf(Array);     // ✅ Type-safe array access
  });
});
```

## Configuration with Types

### Typed Configuration

```typescript
// Configuration interfaces
interface DatabaseConfig {
  sqlFilesPath: string;
  debug: boolean;
  defaultSchema: string;
}

interface RawSqlConfig extends DatabaseConfig {
  cacheTimeout?: number;
  maxRetries?: number;
  retryDelay?: number;
}

// Environment-specific configurations
const configurations: Record<string, RawSqlConfig> = {
  development: {
    sqlFilesPath: './sql',
    debug: true,
    defaultSchema: 'public',
    cacheTimeout: 0, // No caching in development
  },
  test: {
    sqlFilesPath: './sql',
    debug: false,
    defaultSchema: 'test_schema',
    cacheTimeout: 0, // No caching in tests
  },
  production: {
    sqlFilesPath: './dist/sql',
    debug: false,
    defaultSchema: 'public',
    cacheTimeout: 5 * 60 * 1000, // 5 minutes
    maxRetries: 3,
    retryDelay: 1000,
  }
};

// Typed configuration factory
export function createRawSqlClient(env: string = 'development'): RawSqlClient {
  const config = configurations[env];
  
  if (!config) {
    throw new Error(`Configuration for environment '${env}' not found`);
  }

  return new RawSqlClient(prisma, config);
}
```

This comprehensive TypeScript integration ensures type safety throughout your entire application while leveraging the power of raw SQL queries through the `@rawsql-ts/prisma-integration` package.
