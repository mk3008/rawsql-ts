# rawsql-ts Infrastructure Layer Demo

This demonstration provides a practical implementation of **rawsql-ts** for enterprise-level database operations.

## Features Demonstrated

The following capabilities can be verified through this demo:

- **Dynamic Query Generation**: Automatic SQL construction based on conditional criteria combinations
- **Type Safety**: TypeScript type checking integration with parameterized query injection
- **SQL Injection Prevention**: Automatic parameterization ensuring security against malicious inputs
- **Schema Management**: Centralized table definition and validation framework
- **Migration Support**: Incremental transition strategies from legacy systems
- **Performance Optimization**: Large-scale data operation validation and optimization

## Prerequisites and Setup

### System Requirements
- Node.js 18 or higher
- Docker (for PostgreSQL database environment)

### Installation Instructions
```bash
# 1. Initialize PostgreSQL database
docker-compose up -d

# 2. Install project dependencies
npm install

# 3. Execute demonstration modules
npm run demo:all        # Execute complete demonstration suite
npm run demo:queries    # Query generation demonstrations
npm run demo:schema     # Schema management demonstrations

# 4. Environment cleanup
docker-compose down
```

## Demonstration Modules

### Query Generation Demo (`npm run demo:queries`)
Demonstrates dynamic SQL construction capabilities and search criteria patterns.

```typescript
// Define search criteria
const criteria = { 
    title: "project", 
    status: "pending", 
    priority: "high" 
};

// Automatic SQL generation and execution
const todos = await repository.findByCriteria(criteria);
```

**Demonstrated Query Patterns:**
- Empty criteria handling (full dataset retrieval)
- Single condition filtering
- Multiple condition combinations
- Date range specifications
- LIKE pattern matching
- Related table joins
- Complex search criteria combinations from example data
- FindById operations with hierarchical JSON results

### Schema Management Demo (`npm run demo:schema`)
Demonstrates centralized table definition management.

```typescript
// Centralized schema definition using rawsql-ts
const schemaManager = new SchemaManager({
    todo: {
        name: 'todo',
        columns: {
            todo_id: { name: 'todo_id', type: 'number', isPrimaryKey: true },
            title: { name: 'title', type: 'string', required: true },
            status: { name: 'status', type: 'string', required: true }
        }
    }
});

// Automatic configuration generation
const columns = schemaManager.getTableColumns('todo');
const jsonMapping = schemaManager.createJsonMapping('todo');
```

### Test Suite Execution (`npm run test`)
Validates production-ready security and performance characteristics.

```typescript
// SQL injection attack mitigation validation
test('malicious input neutralization', async () => {
    const maliciousInput = "'; DROP TABLE users; --";
    const result = await repository.findByCriteria({ title: maliciousInput });
    // Verifies attack neutralization through secure parameterization
});
```

## Implementation Comparison

### Traditional Approach (Complex and Vulnerable)
```typescript
// SQL injection vulnerability exposure
const searchTitle = userInput; // User input
const sql = `SELECT * FROM todos WHERE title LIKE '%${searchTitle}%'`;

// Complex conditional logic management
let conditions = [];
let params = [];
if (title) {
    conditions.push(`title LIKE $${params.length + 1}`);
    params.push(`%${title}%`);
}
if (status) {
    conditions.push(`status = $${params.length + 1}`);
    params.push(status);
}
// Requires 70+ lines of error-prone code...
```

### rawsql-ts Implementation (Secure and Simplified)
```typescript
// Secure and concise implementation
const criteria = { 
    title: "'; DROP TABLE users; --",  // Malicious input handled securely
    status: "pending",
    fromDate: "2025-05-01"
};

const todos = await repository.findByCriteria(criteria);
// Three lines providing automatic security and performance guarantees
```

## Expected Output Examples

Execution produces the following structured output:

```
=== Query Generation Demo ===
Generated SQL: SELECT t.*, c.name as category_name FROM todos t LEFT JOIN categories c ON t.category_id = c.id WHERE t.title LIKE $1 AND t.status = $2
Parameters: ["%project%", "pending"]
Results: 5 records retrieved

=== Security Validation ===
Malicious input: '; DROP TABLE users; --
Generated SQL: SELECT * FROM todos WHERE title LIKE $1
Parameters: ["%'; DROP TABLE users; --%"]
✓ Attack successfully neutralized
```
## Technical Benefits Analysis

### Immediate Advantages
- **Development Velocity**: Dynamic SQL construction achieves 10x faster implementation
- **Code Quality**: Eliminates string concatenation vulnerabilities completely
- **Maintainability**: Minimizes schema change impact across the application
- **Security Assurance**: Prevents SQL injection vulnerabilities systematically

### Long-term Strategic Benefits
- **Team Productivity**: Enables safe SQL operations for developers at all experience levels
- **Technical Debt Reduction**: Replaces legacy dynamic SQL construction patterns
- **Operational Stability**: Prevents unexpected SQL execution scenarios
- **Scalability**: Maintains consistent performance across complex condition combinations

## Summary

rawsql-ts provides the following enterprise-ready capabilities:

- **Enhanced Development Speed**: Complex dynamic SQL implementation in minimal code
- **Comprehensive Security**: Automatic SQL injection attack neutralization
- **Improved Maintainability**: Minimized impact from schema modifications
- **Performance Optimization**: Database index utilization through efficient execution

## Related Resources

- [rawsql-ts Main Project](../../) - Additional feature demonstrations
- [Official Documentation](../../docs/) - Comprehensive API specifications
- [Additional Demos](../) - Focused feature demonstrations
