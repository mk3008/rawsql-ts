# SchemaManager Usage Guide

The `SchemaManager` class provides unified schema definition and automatic conversion to various formats for rawsql-ts. This guide covers comprehensive usage patterns, configuration options, and integration examples.

## Table of Contents

- [Core Concepts](#core-concepts)
- [Basic Usage](#basic-usage)
- [Schema Definition](#schema-definition)
- [Column Definitions](#column-definitions)
- [Relationships](#relationships)
- [Integration with Other Components](#integration-with-other-components)
- [Advanced Features](#advanced-features)
- [Best Practices](#best-practices)
- [Common Patterns](#common-patterns)
- [Error Handling](#error-handling)

## Core Concepts

`SchemaManager` serves as a central hub for:
- **Unified Schema Definition**: Define database schemas once and reuse across components
- **Type Safety**: Full TypeScript support with comprehensive type definitions
- **Format Conversion**: Automatic conversion to formats required by different utilities
- **Schema Validation**: Built-in schema validation and consistency checks
- **Relationship Management**: Support for complex table relationships

## Basic Usage

### Simple Schema Definition

```typescript
import { SchemaManager, createSchemaManager } from 'rawsql-ts';

// Define a simple schema
const schemas = {
  users: {
    name: 'users',
    displayName: 'User',
    columns: {
      user_id: { 
        name: 'user_id', 
        isPrimaryKey: true
      },
      user_name: { 
        name: 'user_name'
      },
      email: { 
        name: 'email'
      },
      created_at: { 
        name: 'created_at'
      }
    }
  }
};

// Create SchemaManager instance
const schemaManager = createSchemaManager(schemas);

// Basic operations
console.log('Table names:', schemaManager.getTableNames());
console.log('User columns:', schemaManager.getTableColumns('users'));
console.log('Primary key:', schemaManager.getPrimaryKey('users'));
```

## Schema Definition

### TableDefinition Structure

```typescript
interface TableDefinition {
  /** Table name in database */
  name: string;
  /** Human-readable entity name */
  displayName?: string;
  /** Column definitions */
  columns: Record<string, ColumnDefinition>;
  /** Relationships with other tables */
  relationships?: RelationshipDefinition[];
  /** Table-level metadata */
  metadata?: {
    description?: string;
    tags?: string[];
    [key: string]: any;
  };
}
```

### Complete Example

```typescript
const orderSchema = {
  orders: {
    name: 'orders',    displayName: 'Order',
    columns: {
      order_id: {
        name: 'order_id',
        isPrimaryKey: true
      },
      user_id: {
        name: 'user_id',
        foreignKey: {
          table: 'users',
          column: 'user_id'
        }
      },
      order_date: {
        name: 'order_date'
      },
      status: {
        name: 'status'
      },
      total_amount: {
        name: 'total_amount'
      }
    },    relationships: [
      {
        type: 'object',
        table: 'users',
        propertyName: 'customer'
      },
      {
        type: 'array',
        table: 'order_items',
        propertyName: 'items'
      }
    ],
    metadata: {
      description: 'Customer orders table',
      tags: ['commerce', 'transactional']
    }
  }
};
```

## Column Definitions

### Column Options

```typescript
interface ColumnDefinition {
  name: string;                 // Column name in database
  isPrimaryKey?: boolean;       // Required for UPDATE/DELETE operations
  foreignKey?: { table: string; column: string; };
  jsonAlias?: string;           // Alternative name in JSON output
}
```

### Primary Key Requirements

Every table **must** have a primary key defined when using SchemaManager with QueryBuilder operations:

- **UPDATE queries**: Primary keys identify which records to update
- **DELETE queries**: Primary keys identify which records to delete  
- **Schema validation**: Ensures data integrity and prevents orphaned records

```typescript
// ✅ Correct: Table with primary key
const validTable = {
  users: {
    name: 'users',
    columns: {
      user_id: { name: 'user_id', isPrimaryKey: true },
      name: { name: 'name' }
    }
  }
};

// ❌ Error: Table without primary key
const invalidTable = {
  logs: {
    name: 'logs',
    columns: {
      message: { name: 'message' }
      // Missing primary key - will cause validation error
    }
  }
};
```

## Relationships

### Relationship Types

```typescript
type RelationshipType = 'object' | 'array';
```

### Object Relationships (Single Entity)

Use `'object'` for relationships that return a single entity:

```typescript
// Order belongs to User (many-to-one)
const orderToUser = {
  type: 'object',
  table: 'users',
  propertyName: 'customer'
};

// User has one Profile (one-to-one)
const userToProfile = {
  type: 'object',
  table: 'user_profiles',
  propertyName: 'profile'
};
```

### Array Relationships (Multiple Entities)

Use `'array'` for relationships that return multiple entities:

```typescript
// User has many Orders
const userToOrders = {
  type: 'array',
  table: 'orders',
  propertyName: 'orders'
};
```

### Complex Relationship Example

```typescript
const completeSchema = {
  users: {
    name: 'users',
    columns: {
      user_id: { name: 'user_id', isPrimaryKey: true },
      user_name: { name: 'user_name' }
    },
    relationships: [
      {
        type: 'object',        table: 'user_profiles',
        propertyName: 'profile'
      },
      {
        type: 'array',
        table: 'orders',
        propertyName: 'orders'
      }
    ]
  },
  user_profiles: {
    name: 'user_profiles',
    columns: {
      profile_id: { name: 'profile_id', isPrimaryKey: true },
      user_id: { 
        name: 'user_id', 
        foreignKey: { table: 'users', column: 'user_id' }
      },
      bio: { name: 'bio' }
    },    relationships: [
      {
        type: 'object',
        table: 'users',
        propertyName: 'user'
      }
    ]
  },
  orders: {
    name: 'orders',
    columns: {
      order_id: { name: 'order_id', isPrimaryKey: true },
      user_id: { 
        name: 'user_id', 
        foreignKey: { table: 'users', column: 'user_id' }
      }
    },
    relationships: [
      {
        type: 'object',        table: 'users',
        propertyName: 'customer'
      },
      {
        type: 'array',
        table: 'order_items',
        propertyName: 'items'
      }
    ]
  }
};
```

## Integration with Other Components

### SqlParamInjector Integration

```typescript
import { SqlParamInjector, SchemaManager } from 'rawsql-ts';

const schemaManager = createSchemaManager(schemas);

// Create table column resolver
const tableColumnResolver = schemaManager.createTableColumnResolver();

// Use with SqlParamInjector
const injector = new SqlParamInjector({ tableColumnResolver });

const baseSql = 'SELECT * FROM users u WHERE u.active = TRUE';
const searchParams = {
  user_name: { like: '%John%' },
  email: 'john@example.com'
};

const injectedQuery = injector.inject(baseSql, searchParams);
```

### PostgresJsonQueryBuilder Integration

```typescript
import { PostgresJsonQueryBuilder, SelectQueryParser } from 'rawsql-ts';

const schemaManager = createSchemaManager(schemas);

// Create JSON mapping from schema
const jsonMapping = schemaManager.createJsonMapping('users');

// Use with PostgresJsonQueryBuilder
const baseQuery = SelectQueryParser.parse(`
  SELECT u.user_id, u.user_name, o.order_id, o.order_date
  FROM users u
  LEFT JOIN orders o ON u.user_id = o.user_id
`);

const builder = new PostgresJsonQueryBuilder();
const jsonQuery = builder.buildJson(baseQuery, jsonMapping);
```

### SqlSchemaValidator Integration

```typescript
import { SqlSchemaValidator, SelectQueryParser } from 'rawsql-ts';

const schemaManager = createSchemaManager(schemas);

// Create schema object for validator
const validatorSchema = {};
schemaManager.getTableNames().forEach(tableName => {
  validatorSchema[tableName] = schemaManager.getTableColumns(tableName);
});

// Use with SqlSchemaValidator
const validator = new SqlSchemaValidator(validatorSchema);

const query = SelectQueryParser.parse('SELECT user_id, user_name FROM users');
try {
  validator.validate(query);
  console.log('Query is valid');
} catch (error) {
  console.error('Validation failed:', error.message);
}
```

## Advanced Features

### Custom JSON Mapping

```typescript
// Override default JSON property names
const customJsonSchema = {
  users: {
    name: 'users',
    columns: {
      user_id: { 
        name: 'user_id', 
        type: 'number', 
        isPrimaryKey: true,
        jsonAlias: 'id' // Use 'id' in JSON output instead of 'user_id'
      },
      user_name: { 
        name: 'user_name', 
        type: 'string',
        jsonAlias: 'name' // Use 'name' in JSON output
      },
      email_address: { 
        name: 'email_address', 
        type: 'string',
        jsonAlias: 'email' // Use 'email' in JSON output
      }
    }
  }
};

const schemaManager = createSchemaManager(customJsonSchema);
const jsonMapping = schemaManager.createJsonMapping('users');

// JSON mapping will use the aliases:
// { "id": 1, "name": "John", "email": "john@example.com" }
```

### Schema Metadata Usage

```typescript
const schemaWithMetadata = {
  orders: {
    name: 'orders',
    displayName: 'Customer Order',
    columns: {
      order_id: { name: 'order_id', type: 'number', isPrimaryKey: true }
    },
    metadata: {
      description: 'Table storing customer orders',
      tags: ['commerce', 'transactional', 'core'],
      owner: 'commerce-team',
      created: '2024-01-01',
      lastModified: '2024-06-01'
    }
  }
};

const schemaManager = createSchemaManager(schemaWithMetadata);
const table = schemaManager.getTable('orders');

console.log('Table description:', table?.metadata?.description);
console.log('Table tags:', table?.metadata?.tags);
console.log('Table owner:', table?.metadata?.owner);
```

### Dynamic Schema Operations

```typescript
// Get all foreign key relationships
function getAllForeignKeys(schemaManager: SchemaManager) {
  const allForeignKeys = {};
  
  schemaManager.getTableNames().forEach(tableName => {
    const foreignKeys = schemaManager.getForeignKeys(tableName);
    if (foreignKeys.length > 0) {
      allForeignKeys[tableName] = foreignKeys;
    }
  });
  
  return allForeignKeys;
}

// Get table dependency graph
function getTableDependencies(schemaManager: SchemaManager) {
  const dependencies = {};
  
  schemaManager.getTableNames().forEach(tableName => {
    const foreignKeys = schemaManager.getForeignKeys(tableName);
    dependencies[tableName] = foreignKeys.map(fk => fk.referencedTable);
  });
  
  return dependencies;
}

// Usage
const allForeignKeys = getAllForeignKeys(schemaManager);
const dependencies = getTableDependencies(schemaManager);

console.log('Foreign key relationships:', allForeignKeys);
console.log('Table dependencies:', dependencies);
```

## Best Practices

### 1. Schema Organization

```typescript
// Organize schemas by domain/module
const userSchemas = {
  users: { /* user table definition */ },
  user_profiles: { /* profile table definition */ },
  user_sessions: { /* session table definition */ }
};

const orderSchemas = {
  orders: { /* order table definition */ },
  order_items: { /* order items table definition */ },
  order_status_history: { /* status history table definition */ }
};

// Combine schemas
const completeSchemas = {
  ...userSchemas,
  ...orderSchemas
};
```

### 2. Type Safety

```typescript
// Define schema types for better TypeScript support
interface UserTable extends TableDefinition {
  name: 'users';
  columns: {
    user_id: ColumnDefinition & { isPrimaryKey: true };
    user_name: ColumnDefinition;
    email: ColumnDefinition;
  };
}

const userSchema: UserTable = {
  name: 'users',
  columns: {
    user_id: { name: 'user_id', isPrimaryKey: true },
    user_name: { name: 'user_name' },
    email: { name: 'email' }
  }
};
```

### 3. Schema Organization

```typescript
// Organize schemas by domain/module
const userSchemas = {
  users: { /* user table definition */ },
  user_profiles: { /* profile table definition */ },
  user_sessions: { /* session table definition */ }
};

const orderSchemas = {
  orders: { /* order table definition */ },
  order_items: { /* order items table definition */ },
  order_status_history: { /* status history table definition */ }
};

// Combine schemas
const completeSchemas = {
  ...userSchemas,
  ...orderSchemas
};
```

## Common Patterns

### 1. Audit Fields Pattern

```typescript
// Common audit fields for all tables
const auditFields = {
  created_at: {
    name: 'created_at'
  },
  updated_at: {
    name: 'updated_at'
  },
  created_by: {
    name: 'created_by',
    foreignKey: { table: 'users', column: 'user_id' }
  },
  updated_by: {
    name: 'updated_by',
    foreignKey: { table: 'users', column: 'user_id' }
  }
};

// Apply to tables
const auditableSchema = {
  orders: {
    name: 'orders',
    columns: {
      order_id: { name: 'order_id', isPrimaryKey: true },
      // ... other order fields
      ...auditFields
    }
  },
  products: {
    name: 'products',
    columns: {
      product_id: { name: 'product_id', isPrimaryKey: true },
      // ... other product fields
      ...auditFields
    }
  }
};
```

### 2. Soft Delete Pattern

```typescript
const softDeleteSchema = {
  users: {
    name: 'users',
    columns: {
      user_id: { name: 'user_id', isPrimaryKey: true },
      user_name: { name: 'user_name' },
      email: { name: 'email' },
      is_deleted: { 
        name: 'is_deleted'
      },
      deleted_at: { 
        name: 'deleted_at'
      },
      deleted_by: { 
        name: 'deleted_by',
        foreignKey: { table: 'users', column: 'user_id' }
      }
    }
  }
};
```

### 3. Multi-tenant Pattern

```typescript
const multiTenantSchema = {
  tenants: {
    name: 'tenants',
    columns: {
      tenant_id: { name: 'tenant_id', isPrimaryKey: true },
      tenant_name: { name: 'tenant_name' }
    }
  },
  users: {
    name: 'users',
    columns: {
      user_id: { name: 'user_id', isPrimaryKey: true },
      tenant_id: { 
        name: 'tenant_id',
        foreignKey: { table: 'tenants', column: 'tenant_id' }
      },
      user_name: { name: 'user_name' },
      email: { name: 'email' }
    },
    relationships: [
      {
        type: 'object',
        table: 'tenants',
        foreignKey: 'tenant_id',
        propertyName: 'tenant'
      }
    ]
  }
};
```

## Error Handling

### Schema Validation Errors

```typescript
try {
  const invalidSchema = {
    users: {
      name: 'users',
      columns: {
        // Missing primary key - will cause validation error
        user_name: { name: 'user_name', type: 'string' }
      }
    }
  };
  
  const schemaManager = createSchemaManager(invalidSchema);
} catch (error) {
  console.error('Schema validation failed:', error.message);
  // Output: Schema validation failed: Table 'users' has no primary key defined
}
```

### Missing Table/Column Errors

```typescript
const schemaManager = createSchemaManager(validSchemas);

// Handle missing table
const missingTableColumns = schemaManager.getTableColumns('nonexistent_table');
console.log(missingTableColumns); // Returns empty array []

// Handle missing table in operations
try {
  const jsonMapping = schemaManager.createJsonMapping('nonexistent_table');
} catch (error) {
  console.error('Error:', error.message);
  // Output: Table 'nonexistent_table' not found in schema registry
}
```

### Relationship Validation

```typescript
const invalidRelationshipSchema = {
  orders: {
    name: 'orders',
    columns: {
      order_id: { name: 'order_id', type: 'number', isPrimaryKey: true }
    },    relationships: [
      {
        type: 'object',
        table: 'nonexistent_users', // Invalid table reference
        propertyName: 'customer'
      }
    ]
  }
};

try {
  const schemaManager = createSchemaManager(invalidRelationshipSchema);
} catch (error) {
  console.error('Relationship validation failed:', error.message);
  // Output: Table 'orders' references unknown table 'nonexistent_users' in relationship
}
```

---

This comprehensive guide covers all aspects of using `SchemaManager` effectively. The class provides a powerful foundation for managing database schemas in a type-safe, consistent manner across all rawsql-ts components.
