# rawsql-ts Infrastructure Layer Demo

This demonstration provides a comprehensive implementation of **rawsql-ts** for enterprise-grade database operations, showcasing advanced patterns including DTO (Data Transfer Object) structures, runtime type safety, and performance comparisons with popular ORMs.

## Features Demonstrated

The following enterprise-ready capabilities are demonstrated:

- **Advanced Type Safety**: Runtime type validation with TypeScript compile-time checking
- **Prisma vs rawsql-ts Approach Comparison**: Generated SQL analysis and architectural differences
- **Query Optimization**: Minimized query count and infrastructure communication overhead
- **Dynamic Query Generation**: Conditional SQL construction with automatic parameterization
- **SQL Injection Prevention**: Comprehensive security through parameterized queries
- **Infrastructure Layer Patterns**: Clean architecture implementation with repository patterns
- **Advanced FindById Operations**: Hierarchical JSON mapping for complex data structures

## Prerequisites and Setup

### System Requirements
- Node.js 18 or higher
- Docker (for PostgreSQL database environment)

### Installation Instructions
```bash
# 1. Start PostgreSQL database container
docker-compose up -d

# 2. Initialize database schema using init-db.sql
# (Database schema is created from existing SQL file, not Prisma migrations)
# Execute the following command to set up the database schema:  
docker exec -i rawsql-infrastructure-demo-db psql -U demo_user -d infrastructure_demo < init-db.sql

# The init-db.sql file contains the primary database structure

# 3. Install project dependencies
npm install

# 4. Generate Prisma client for comparison demo
npm run prisma:generate

# 5. Execute demonstration modules
npm run demo:comparison    # Prisma vs rawsql-ts approach comparison demo
npm run demo:findById      # Advanced hierarchical JSON mapping demo
npm run test              # Comprehensive test suite

# 6. Environment cleanup
docker-compose down
```

## Available Demo Scripts

- `npm run demo:comparison` - Execute Prisma vs rawsql-ts comparison
- `npm run demo:findById` - Run advanced hierarchical mapping demo  
- `npm run test` - Run validation test suite
- `npm run prisma:studio` - Open database browser (optional)

## Architectural Approach Comparison

This demo generates detailed SQL comparison reports between Prisma and rawsql-ts approaches. 

**📊 See detailed analysis:** `reports/prisma-vs-rawsql-comparison.md`

### Key Findings Summary

**Query Strategy:**
- **Raw SQL Approach:**
  - Prisma: Data source definition
  - rawsql-ts: Procedure definition for data sources
- **Dynamic Search Conditions:**
  - Prisma: Requires branching logic for arbitrary search condition combinations
  - rawsql-ts: SQL and search conditions are separated (simple condition DTO mapping, easy omission handling)
- **Query Result Handling:**
  - Prisma: Table definition-dependent return values, requires local DTO mapping
  - rawsql-ts: Express DTOs directly in SQL as scalar values (1 row, 1 column)
- **Development Environment**: 
  - Prisma: TypeScript environment with generated type-safe API
  - rawsql-ts: DB client environment for generic SQL + TypeScript transformation
- **Query Generation**:
  - Prisma: Simple queries generated separately for each relation
  - rawsql-ts: Complex optimized queries dynamically specialized from generic patterns
- **Testing & Debugging**:
  - Prisma: Requires TypeScript execution environment for query testing
  - rawsql-ts: Direct SQL execution in DB client (no DSL dependencies)
- **SQL Syntax Checking**:
  - Prisma: Generated type code eliminates need for syntax testing (pre-validated)
  - rawsql-ts: Static schema validation enables SQL statement syntax checking

> **Note:** rawsql-ts provides actual SQL unit tests (see `test/` folder for examples) - a rare capability in the SQL ecosystem.

**Infrastructure Impact:**
- **Network Round-trips**: 
  - Prisma: Multiple queries (2-3 per operation)
  - rawsql-ts: Single optimized query with JOINs
- **Memory Usage**: 
  - Prisma: Object hydration + manual flattening overhead
  - rawsql-ts: Direct DTO mapping without intermediate objects
- **Type Safety**: 
  - Prisma: Type-safe query code generation + schema auto-generation from DB
  - rawsql-ts: Raw SQL development + static schema validation

**Use Case Optimization:**
- **Table Views**: 
  - Prisma: Object mapping + manual flattening for UI components
  - rawsql-ts: Direct flat structure optimized for list display
- **Detail Views**: 
  - Prisma: Multiple queries + client-side object composition
  - rawsql-ts: Complex JSON aggregation in single CTE query
- **Search Operations**: 
  - Prisma: Generated queries with fixed parameter patterns
  - rawsql-ts: Dynamic query building with runtime parameterization

Execute `npm run demo:comparison` to generate fresh comparison reports with your current database state.

## Expected Output Examples

Execution of the enhanced demo produces detailed SQL generation analysis:

```
=== Architectural Approach Comparison Demo ===

1. Generated SQL Analysis:
   
   Prisma Approach:
   Query 1: SELECT "Todo"."id", "Todo"."title" FROM "Todo" WHERE "Todo"."title" ILIKE $1
   Query 2: SELECT "Status"."id", "Status"."name" FROM "Status" WHERE "Status"."id" IN ($1, $2)
   Query 3: SELECT "Category"."id", "Category"."name" FROM "Category" WHERE "Category"."id" IN ($1, $2)
   Total Queries: 3
   Network Round-trips: 3
   
   rawsql-ts Approach:
   Query: SELECT t.todo_id, t.title, c.name as category_name FROM todo t LEFT JOIN category c ON t.category_id = c.category_id WHERE t.title LIKE $1
   Total Queries: 1
   Network Round-trips: 1
   ✓ Infrastructure communication optimized
   
2. Query Performance Analysis:
   Prisma execution time: 45.23ms (3 queries + object mapping)
   rawsql-ts execution time: 12.87ms (1 optimized query)
   Communication overhead reduction: 3x fewer database calls
   
3. TodoTableView Pattern Demonstration:
   ✓ Flat DTO structure optimized for UI
   ✓ Runtime type validation successful
   ✓ Database null to TypeScript undefined mapping
   
4. Security Validation:
   Malicious input: '; DROP TABLE todos; --
   Generated SQL: SELECT ... WHERE title LIKE $1
   Parameters: ["%'; DROP TABLE todos; --%"]
   ✓ SQL injection attack successfully neutralized

=== Advanced FindById Demo ===
Single CTE Query with JSON Aggregation:
WITH origin_query AS (...), cte_object_depth_1 AS (...), cte_array_depth_1 AS (...)
SELECT jsonb_build_object(...) as todo FROM cte_root_todo

Retrieved hierarchical structure:
{
  todo: { id: 1, title: "Sample Todo", status: { name: "In Progress" } },
  comments: [{ id: 1, content: "Initial comment" }],
  attachments: [{ id: 1, filename: "specification.pdf" }]
}
✓ Complex JSON mapping in single query execution
```

## Architecture Benefits Analysis

### Type Safety Advantages
- **Compile-time Safety**: Full TypeScript integration with IDE support
- **Runtime Validation**: Database schema consistency verification
- **Error Prevention**: Invalid data structure detection at the boundary layer
- **Null Safety**: Explicit handling of database null vs TypeScript undefined

### Performance Benefits
- **Direct SQL Execution**: No ORM overhead or object hydration costs
- **Optimized Queries**: Database-specific optimization capabilities
- **Minimal Memory Footprint**: Direct DTO mapping without intermediate objects
- **Reduced Network Traffic**: Flat structure optimized for UI consumption

### Development Experience
- **No Code Generation**: Direct implementation without build-time dependencies
- **IDE Integration**: Full autocomplete and type checking support
- **Immediate Feedback**: Runtime validation with clear error messages
- **Simplified Debugging**: Direct SQL visibility and parameter inspection

## Enterprise Integration Patterns

### Clean Architecture Implementation
The demonstration showcases clean architecture principles:

```typescript
// Domain Layer - Pure business entities
interface TodoTableView {
    todoId: number;
    title: string;
    statusName: string;
    // ... business-focused flat structure
}

// Infrastructure Layer - Database operations with type safety
class RawSqlTodoRepository implements TodoRepository {
    async findByCriteria(criteria: TodoSearchCriteria): Promise<TodoTableView[]> {
        // Type-safe database operations with runtime validation
    }
}

// Application Layer - Use case orchestration
class TodoService {
    constructor(private todoRepository: TodoRepository) {}
    
    async searchTodos(criteria: TodoSearchCriteria): Promise<TodoTableView[]> {
        return this.todoRepository.findByCriteria(criteria);
    }
}
```

### Migration Strategy
For existing Prisma-based applications:

1. **Parallel Implementation**: Implement rawsql-ts alongside existing Prisma code
2. **Performance Validation**: Compare execution times and memory usage
3. **Gradual Migration**: Replace performance-critical operations first
4. **Type Safety Enhancement**: Add runtime validation for data consistency
5. **Code Simplification**: Eliminate complex ORM mapping layers

## Summary

This infrastructure layer demonstration provides enterprise-ready capabilities:

- **Enhanced Type Safety**: Compile-time and runtime validation for robust applications
- **TodoTableView Pattern**: Optimized flat DTO structures for UI performance
- **Prisma Comparison**: Quantified performance benefits and complexity reduction
- **Security Guarantees**: Comprehensive SQL injection prevention
- **Clean Architecture**: Proper separation of concerns with testable components
- **Migration Support**: Practical strategies for existing application modernization

## Related Resources

- [rawsql-ts Main Project](../../) - Core library documentation and examples
- [API Documentation](../../docs/) - Comprehensive usage guides and API specifications
- [AI Maintenance Guide](./docs/AI-MAINTENANCE-GUIDE.md) - Development and maintenance procedures
- [Additional Demos](../) - Focused feature demonstrations and usage patterns

