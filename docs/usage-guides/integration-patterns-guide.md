# Integration Patterns Guide

This guide covers common integration patterns when using `@rawsql-ts/prisma-integration` in real-world applications.

## Hybrid Architecture Pattern

The most common and recommended approach: use Prisma for simple operations and RawSqlClient for complex queries.

```typescript
import { PrismaClient } from '@prisma/client';
import { RawSqlClient } from '@rawsql-ts/prisma-integration';

export class UserService {
  private prisma: PrismaClient;
  private rawSql: RawSqlClient;

  constructor() {
    this.prisma = new PrismaClient();
    this.rawSql = new RawSqlClient(this.prisma, {
      sqlFilesPath: './sql'
    });
  }

  // Use Prisma for simple CRUD operations
  async createUser(userData: CreateUserData) {
    return this.prisma.user.create({
      data: userData
    });
  }

  async updateUser(id: number, userData: UpdateUserData) {
    return this.prisma.user.update({
      where: { id },
      data: userData
    });
  }

  // Use RawSqlClient for complex queries with JSON mapping
  async getUserProfile(userId: number): Promise<UserProfile> {
    return this.rawSql.queryOne<UserProfile>('users/get-profile.sql', { userId });
  }

  async searchUsers(criteria: SearchCriteria): Promise<UserSearchResult[]> {
    return this.rawSql.queryMany<UserSearchResult>('users/search.sql', {
      filter: criteria,
      sort: { created_at: { desc: true } },
      paging: { page: 1, pageSize: 20 }
    });
  }
}
```

## Repository Pattern

Implement the repository pattern with RawSqlClient for better separation of concerns.

```typescript
// repositories/UserRepository.ts
import { RawSqlClient } from '@rawsql-ts/prisma-integration';

export interface IUserRepository {
  findById(id: number): Promise<User | null>;
  findProfileById(id: number): Promise<UserProfile | null>;
  search(criteria: UserSearchCriteria): Promise<UserSearchResult[]>;
}

export class UserRepository implements IUserRepository {
  constructor(private rawSql: RawSqlClient) {}

  async findById(id: number): Promise<User | null> {
    const users = await this.rawSql.queryMany<User>('users/find-by-id.sql', { id });
    return users[0] || null;
  }

  async findProfileById(id: number): Promise<UserProfile | null> {
    return this.rawSql.queryOne<UserProfile>('users/get-profile.sql', { userId: id });
  }

  async search(criteria: UserSearchCriteria): Promise<UserSearchResult[]> {
    return this.rawSql.queryMany<UserSearchResult>('users/search.sql', {
      filter: criteria.filters,
      sort: criteria.sorting,
      paging: criteria.pagination
    });
  }
}

// services/UserService.ts
export class UserService {
  constructor(
    private userRepository: IUserRepository,
    private prisma: PrismaClient
  ) {}

  async getUser(id: number): Promise<User | null> {
    return this.userRepository.findById(id);
  }

  async getUserWithProfile(id: number): Promise<UserProfile | null> {
    return this.userRepository.findProfileById(id);
  }

  async createUser(userData: CreateUserData): Promise<User> {
    // Use Prisma for writes
    return this.prisma.user.create({ data: userData });
  }
}
```

## Factory Pattern for Multiple Databases

Handle multiple database connections with a factory pattern.

```typescript
// database/DatabaseFactory.ts
import { PrismaClient } from '@prisma/client';
import { RawSqlClient } from '@rawsql-ts/prisma-integration';

export interface DatabaseClients {
  prisma: PrismaClient;
  rawSql: RawSqlClient;
}

export class DatabaseFactory {
  private static instances: Map<string, DatabaseClients> = new Map();

  static getClients(database: string = 'default'): DatabaseClients {
    if (!this.instances.has(database)) {
      const prisma = new PrismaClient({
        datasources: {
          db: {
            url: process.env[`${database.toUpperCase()}_DATABASE_URL`]
          }
        }
      });

      const rawSql = new RawSqlClient(prisma, {
        sqlFilesPath: `./sql/${database}`,
        debug: process.env.NODE_ENV === 'development'
      });

      this.instances.set(database, { prisma, rawSql });
    }

    return this.instances.get(database)!;
  }

  static async disconnectAll(): Promise<void> {
    const promises = Array.from(this.instances.values()).map(
      clients => clients.prisma.$disconnect()
    );
    await Promise.all(promises);
    this.instances.clear();
  }
}

// Usage in services
export class AnalyticsService {
  private mainDb = DatabaseFactory.getClients('main');
  private analyticsDb = DatabaseFactory.getClients('analytics');

  async getUserStats(userId: number) {
    // Query from main database
    const user = await this.mainDb.rawSql.queryOne('users/get-basic.sql', { userId });
    
    // Query from analytics database
    const stats = await this.analyticsDb.rawSql.queryOne('stats/user-metrics.sql', { userId });
    
    return { user, stats };
  }
}
```

## Dependency Injection Pattern

Integration with popular DI containers.

### Using TypeScript with InversifyJS

```typescript
// container/types.ts
export const TYPES = {
  PrismaClient: Symbol.for('PrismaClient'),
  RawSqlClient: Symbol.for('RawSqlClient'),
  UserService: Symbol.for('UserService'),
  UserRepository: Symbol.for('UserRepository')
};

// container/container.ts
import { Container } from 'inversify';
import { PrismaClient } from '@prisma/client';
import { RawSqlClient } from '@rawsql-ts/prisma-integration';

const container = new Container();

container.bind<PrismaClient>(TYPES.PrismaClient).toConstantValue(
  new PrismaClient()
);

container.bind<RawSqlClient>(TYPES.RawSqlClient).toDynamicValue(context => {
  const prisma = context.container.get<PrismaClient>(TYPES.PrismaClient);
  return new RawSqlClient(prisma, { sqlFilesPath: './sql' });
});

container.bind<IUserRepository>(TYPES.UserRepository).to(UserRepository);
container.bind<UserService>(TYPES.UserService).to(UserService);

export { container };

// services/UserService.ts
import { injectable, inject } from 'inversify';

@injectable()
export class UserService {
  constructor(
    @inject(TYPES.UserRepository) private userRepository: IUserRepository,
    @inject(TYPES.PrismaClient) private prisma: PrismaClient
  ) {}

  // Service methods...
}
```

### Using NestJS

```typescript
// database/database.module.ts
import { Module } from '@nestjs/common';
import { PrismaService } from './prisma.service';
import { RawSqlService } from './rawsql.service';

@Module({
  providers: [PrismaService, RawSqlService],
  exports: [PrismaService, RawSqlService]
})
export class DatabaseModule {}

// database/rawsql.service.ts
import { Injectable } from '@nestjs/common';
import { RawSqlClient } from '@rawsql-ts/prisma-integration';
import { PrismaService } from './prisma.service';

@Injectable()
export class RawSqlService extends RawSqlClient {
  constructor(prismaService: PrismaService) {
    super(prismaService, {
      sqlFilesPath: './sql',
      debug: process.env.NODE_ENV === 'development'
    });
  }
}

// users/users.service.ts
import { Injectable } from '@nestjs/common';
import { RawSqlService } from '../database/rawsql.service';

@Injectable()
export class UsersService {
  constructor(private rawSql: RawSqlService) {}

  async findUserProfile(id: number): Promise<UserProfile> {
    return this.rawSql.queryOne<UserProfile>('users/get-profile.sql', { userId: id });
  }
}
```

## Transaction Pattern

Handle transactions across Prisma and RawSqlClient.

```typescript
export class OrderService {
  constructor(
    private prisma: PrismaClient,
    private rawSql: RawSqlClient
  ) {}

  async processOrder(orderData: CreateOrderData): Promise<OrderResult> {
    return this.prisma.$transaction(async (tx) => {
      // Use Prisma transaction for writes
      const order = await tx.order.create({
        data: {
          customerId: orderData.customerId,
          items: {
            create: orderData.items
          }
        }
      });

      // Use raw SQL for complex calculations within the same transaction
      // Note: RawSqlClient will use the same connection as the transaction
      const orderSummary = await this.rawSql.queryOne<OrderSummary>(
        'orders/calculate-summary.sql',
        { orderId: order.id }
      );

      // Update inventory using Prisma
      for (const item of orderData.items) {
        await tx.product.update({
          where: { id: item.productId },
          data: {
            inventory: {
              decrement: item.quantity
            }
          }
        });
      }

      return {
        order,
        summary: orderSummary
      };
    });
  }
}
```

## Caching Pattern

Implement caching with RawSqlClient results.

```typescript
import { createHash } from 'crypto';

export class CachedUserService {
  private cache = new Map<string, { data: any; timestamp: number }>();
  private cacheTimeout = 5 * 60 * 1000; // 5 minutes

  constructor(private rawSql: RawSqlClient) {}

  private getCacheKey(query: string, params: any): string {
    const key = JSON.stringify({ query, params });
    return createHash('md5').update(key).digest('hex');
  }

  private isExpired(timestamp: number): boolean {
    return Date.now() - timestamp > this.cacheTimeout;
  }

  async queryWithCache<T>(
    sqlFile: string, 
    params: any = {},
    cacheFor: number = this.cacheTimeout
  ): Promise<T[]> {
    const cacheKey = this.getCacheKey(sqlFile, params);
    const cached = this.cache.get(cacheKey);

    if (cached && !this.isExpired(cached.timestamp)) {
      return cached.data;
    }

    const result = await this.rawSql.queryMany<T>(sqlFile, params);
    
    this.cache.set(cacheKey, {
      data: result,
      timestamp: Date.now()
    });

    return result;
  }

  async getUserProfile(userId: number): Promise<UserProfile> {
    const results = await this.queryWithCache<UserProfile>(
      'users/get-profile.sql',
      { userId },
      10 * 60 * 1000 // Cache for 10 minutes
    );
    
    return results[0];
  }

  clearCache(): void {
    this.cache.clear();
  }
}
```

## Error Handling Pattern

Implement comprehensive error handling for RawSqlClient operations.

```typescript
import { Prisma } from '@prisma/client';

export enum SqlErrorType {
  FILE_NOT_FOUND = 'FILE_NOT_FOUND',
  SQL_SYNTAX_ERROR = 'SQL_SYNTAX_ERROR',
  DATABASE_ERROR = 'DATABASE_ERROR',
  MAPPING_ERROR = 'MAPPING_ERROR'
}

export class SqlError extends Error {
  constructor(
    public type: SqlErrorType,
    message: string,
    public originalError?: Error,
    public context?: any
  ) {
    super(message);
    this.name = 'SqlError';
  }
}

export class SafeUserService {
  constructor(private rawSql: RawSqlClient) {}

  async getUserProfile(userId: number): Promise<UserProfile | null> {
    try {
      return await this.rawSql.queryOne<UserProfile>('users/get-profile.sql', { userId });
    } catch (error) {
      return this.handleSqlError(error, 'getUserProfile', { userId });
    }
  }

  private handleSqlError(error: any, operation: string, context: any): null {
    if (error.message.includes('SQL file') && error.message.includes('not found')) {
      throw new SqlError(
        SqlErrorType.FILE_NOT_FOUND,
        `SQL file missing for operation: ${operation}`,
        error,
        context
      );
    }

    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      throw new SqlError(
        SqlErrorType.DATABASE_ERROR,
        `Database error in ${operation}: ${error.message}`,
        error,
        context
      );
    }

    if (error.message.includes('JSON mapping')) {
      throw new SqlError(
        SqlErrorType.MAPPING_ERROR,
        `JSON mapping error in ${operation}`,
        error,
        context
      );
    }

    // Default to database error
    throw new SqlError(
      SqlErrorType.SQL_SYNTAX_ERROR,
      `SQL execution failed in ${operation}: ${error.message}`,
      error,
      context
    );
  }
}

// Usage with error handling
export class UserController {
  constructor(private userService: SafeUserService) {}

  async getProfile(req: Request, res: Response) {
    try {
      const userId = parseInt(req.params.id);
      const profile = await this.userService.getUserProfile(userId);
      
      if (!profile) {
        return res.status(404).json({ error: 'User not found' });
      }

      res.json(profile);
    } catch (error) {
      if (error instanceof SqlError) {
        switch (error.type) {
          case SqlErrorType.FILE_NOT_FOUND:
            return res.status(500).json({ error: 'Query configuration missing' });
          case SqlErrorType.DATABASE_ERROR:
            return res.status(503).json({ error: 'Database temporarily unavailable' });
          default:
            return res.status(500).json({ error: 'Internal server error' });
        }
      }
      
      // Unknown error
      console.error('Unexpected error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }
}
```

## Testing Pattern

Test services that use RawSqlClient with proper mocking.

```typescript
// __tests__/UserService.test.ts
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { PrismaClient } from '@prisma/client';
import { RawSqlClient } from '@rawsql-ts/prisma-integration';
import { UserService } from '../UserService';

// Mock RawSqlClient
vi.mock('@rawsql-ts/prisma-integration', () => ({
  RawSqlClient: vi.fn().mockImplementation(() => ({
    queryOne: vi.fn(),
    queryMany: vi.fn(),
  }))
}));

describe('UserService', () => {
  let userService: UserService;
  let mockRawSql: any;
  let mockPrisma: any;

  beforeEach(() => {
    mockPrisma = {
      user: {
        create: vi.fn(),
        update: vi.fn(),
        delete: vi.fn()
      }
    };

    mockRawSql = new RawSqlClient(mockPrisma);
    userService = new UserService(mockPrisma, mockRawSql);
  });

  it('should get user profile', async () => {
    const mockProfile = {
      id: 1,
      name: 'John Doe',
      email: 'john@example.com',
      profile: { title: 'Engineer', bio: 'Software developer' }
    };

    mockRawSql.queryOne.mockResolvedValue(mockProfile);

    const result = await userService.getUserProfile(1);

    expect(mockRawSql.queryOne).toHaveBeenCalledWith('users/get-profile.sql', { userId: 1 });
    expect(result).toEqual(mockProfile);
  });

  it('should create user with Prisma', async () => {
    const userData = { name: 'Jane Doe', email: 'jane@example.com' };
    const mockUser = { id: 2, ...userData };

    mockPrisma.user.create.mockResolvedValue(mockUser);

    const result = await userService.createUser(userData);

    expect(mockPrisma.user.create).toHaveBeenCalledWith({ data: userData });
    expect(result).toEqual(mockUser);
  });
});
```

## Configuration Pattern

Manage different configurations for different environments.

```typescript
// config/database.config.ts
export interface DatabaseConfig {
  sqlFilesPath: string;
  debug: boolean;
  defaultSchema: string;
  cacheTimeout?: number;
}

export const getDatabaseConfig = (): DatabaseConfig => {
  const env = process.env.NODE_ENV || 'development';
  
  const configs: Record<string, DatabaseConfig> = {
    development: {
      sqlFilesPath: './sql',
      debug: true,
      defaultSchema: 'public'
    },
    test: {
      sqlFilesPath: './sql',
      debug: false,
      defaultSchema: 'test_schema'
    },
    production: {
      sqlFilesPath: './dist/sql',
      debug: false,
      defaultSchema: 'public',
      cacheTimeout: 10 * 60 * 1000 // 10 minutes
    }
  };

  return configs[env] || configs.development;
};

// database/DatabaseClient.ts
export class DatabaseClient {
  public readonly prisma: PrismaClient;
  public readonly rawSql: RawSqlClient;

  constructor() {
    const config = getDatabaseConfig();
    
    this.prisma = new PrismaClient({
      log: config.debug ? ['query', 'info', 'warn', 'error'] : ['error']
    });

    this.rawSql = new RawSqlClient(this.prisma, {
      sqlFilesPath: config.sqlFilesPath,
      debug: config.debug,
      defaultSchema: config.defaultSchema
    });
  }

  async disconnect(): Promise<void> {
    await this.prisma.$disconnect();
  }
}
```

These patterns provide a solid foundation for integrating `@rawsql-ts/prisma-integration` into various application architectures while maintaining clean, testable, and maintainable code.
