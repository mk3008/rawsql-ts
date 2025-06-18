# Unified JSON Mapping Usage Guide

This guide provides comprehensive instructions for creating Unified JSON Mapping files that transform flat SQL results into structured, type-safe domain models. The Unified JSON Mapping format integrates type protection and mapping configuration into a single file.

## Overview

Unified JSON Mapping enables:
- **Type Protection**: Built-in `forceString` protection for string fields
- **Automatic Type Validation**: Validates TypeScript interfaces against SQL results
- **Static Analysis**: Catches type mismatches and protection issues during development
- **Single File Configuration**: No need for separate .types.json files
- **Domain Model Integration**: Links SQL queries directly to TypeScript domain models

## Unified JSON Mapping Structure

### Complete Example

```json
{
  "rootName": "todo",
  "typeInfo": {
    "interface": "TodoDetail",
    "importPath": "src/contracts/todo-detail.ts"
  },
  "protectedStringFields": [
    "title", "description", "user_name", "email", 
    "category_name", "color", "comment_text"
  ],
  "rootEntity": {
    "id": "todo",
    "name": "Todo",
    "columns": {
      "todoId": "todo_id",
      "title": {
        "column": "title",
        "forceString": true
      },
      "description": {
        "column": "description", 
        "forceString": true
      },
      "completed": "completed",
      "createdAt": "created_at",
      "updatedAt": "updated_at"
    }
  },
  "nestedEntities": [
    {
      "id": "user",
      "name": "User", 
      "parentId": "todo",
      "propertyName": "user",
      "relationshipType": "object",
      "columns": {
        "userId": "user_id",
        "userName": {
          "column": "user_name",
          "forceString": true
        },
        "email": {
          "column": "email",
          "forceString": true
        },
        "createdAt": "user_created_at"
      }
    },
    {
      "id": "category",
      "name": "Category",
      "parentId": "todo", 
      "propertyName": "category",
      "relationshipType": "object",
      "columns": {
        "categoryId": "category_id",
        "categoryName": {
          "column": "category_name",
          "forceString": true
        },
        "color": {
          "column": "color",
          "forceString": true
        },
        "createdAt": "category_created_at"
      }
    }
  ]
}
```

## Field Definitions

### Root Level Fields

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `rootName` | string | Yes | Unique identifier for the mapping |
| `typeInfo` | object | No | Global type information for the root interface |
| `protectedStringFields` | array | No | List of database columns that should be protected with forceString |
| `rootEntity` | object | Yes | Definition of the root entity structure |
| `nestedEntities` | array | No | Array of nested entity definitions |
| `useJsonb` | boolean | No | Whether to use JSONB aggregation (default: true) |

### TypeInfo Object

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `interface` | string | Yes | TypeScript interface name |
| `importPath` | string | No | Path to import the interface from |

### Entity Definition

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `id` | string | Yes | Unique identifier for this entity |
| `name` | string | Yes | Display name for the entity |
| `parentId` | string | No | ID of parent entity (for nested entities) |
| `propertyName` | string | No | Property name in parent object (for nested entities) |
| `relationshipType` | string | No | Type of relationship: "object" or "array" |
| `columns` | object | Yes | Column mapping configuration |

### Column Mapping Configuration

Column mappings can be defined in two ways:

#### Simple String Mapping
```json
{
  "fieldName": "database_column_name"
}
```

#### Advanced Object Mapping
```json
{
  "fieldName": {
    "column": "database_column_name",
    "forceString": true
  }
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `column` | string | Yes | Database column name |
| `forceString` | boolean | No | Force value to be converted to string for type safety |

## String Field Protection

### Why Use forceString?

String fields in the database may return unexpected types due to:
- Database driver type conversion
- Numeric values stored as strings
- Date/timestamp formatting differences
- NULL value handling

### When to Use forceString

Use `forceString: true` for:
- User-generated content (titles, descriptions, names)
- Email addresses and usernames  
- Text-based identifiers
- Content that should always be treated as strings

### Example with Protection

```json
{
  "columns": {    "title": {
      "column": "title",
      "forceString": true
    },
    "email": {
      "column": "email", 
      "forceString": true
    },
    "id": "user_id",  // Numbers don't need forceString
    "isActive": "is_active"  // Booleans don't need forceString
  }
}

## Relationship Types

### Object Relationship (0..1)
```json
{
  "relationshipType": "object",
  "propertyName": "profile"
}
```
- Maps to single object property in TypeScript
- Used for one-to-one or one-to-zero relationships
- Results in `profile: { title: string, bio: string }` structure

### Array Relationship (0..N)
```json
{
  "relationshipType": "array",
  "propertyName": "posts"
}
```
- Maps to array property in TypeScript
- Used for one-to-many relationships
- Results in `posts: Array<{ id: number, title: string, content: string }>` structure

## AI Generation Template

Use this template to prompt AI tools for generating Enhanced JSON Mapping files:

### Prompt Template

```
Create an Enhanced JSON Mapping file for transforming SQL results into the following TypeScript interface:

**TypeScript Interface:**
```typescript
[PASTE YOUR INTERFACE HERE]
```

**SQL Query:**
```sql
[PASTE YOUR SQL QUERY HERE]
```

**Requirements:**
- Use Enhanced JSON Mapping format with typeInfo validation
- Map SQL column aliases to TypeScript property names
- Include proper relationshipType ("object" for single nested objects, "array" for collections)
- Add detailed property type information for validation
- Use unique entity IDs and clear naming

Please generate the complete JSON mapping file following the Enhanced JSON Mapping specification.
```

### Example AI Prompt

```
Create an Enhanced JSON Mapping file for transforming SQL results into the following TypeScript interface:

**TypeScript Interface:**
```typescript
interface UserProfile {
  id: number;
  name: string;
  email: string;
  profile: {
    title: string;
    bio: string;
  };
  posts: Array<{
    id: number;
    title: string;
    content: string;
  }>;
}
```

**SQL Query:**
```sql
SELECT 
  u.id as user_id, u.name, u.email,
  p.title as profile_title, p.bio as profile_bio,
  pt.id as post_id, pt.title as post_title, pt.content as post_content
FROM users u
LEFT JOIN profiles p ON u.id = p.user_id  
LEFT JOIN posts pt ON u.id = pt.author_id
```

**Requirements:**
- Use Enhanced JSON Mapping format with typeInfo validation
- Map SQL column aliases to TypeScript property names
- Include proper relationshipType ("object" for single nested objects, "array" for collections)
- Add detailed property type information for validation
- Use unique entity IDs and clear naming

Please generate the complete JSON mapping file following the Enhanced JSON Mapping specification.
```

## Best Practices

### 1. Naming Conventions
- Use descriptive `id` values for entities (`"user"`, `"profile"`, `"posts"`)
- Choose clear `propertyName` values that match TypeScript interface properties
- Use meaningful `rootName` that describes the overall data structure

### 2. Column Mapping Strategy
- Always use unique column aliases in SQL to avoid conflicts
- Map SQL snake_case to TypeScript camelCase consistently
- Prefix columns with entity identifiers (`user_id`, `profile_title`, `post_id`)

### 3. Type Validation
- Include `typeInfo` for all entities when using static analysis
- Set `required: true` for non-nullable database columns
- Use appropriate TypeScript types (`"Date"` for timestamps, `"number"` for IDs)

### 4. Relationship Modeling
- Use `"object"` for optional single relationships (profile might not exist)
- Use `"array"` for collections (user can have multiple posts)
- Ensure parent-child relationships are properly defined with `parentId`

## Common Patterns

### Simple Entity (No Nesting)
```json
{
  "rootName": "user",
  "typeInfo": {
    "interface": "User",
    "importPath": "src/types/user.ts"
  },
  "rootEntity": {
    "id": "user",
    "name": "User",
    "columns": {
      "id": "user_id",
      "name": {
        "column": "name",
        "forceString": true
      },
      "email": {
        "column": "email",
        "forceString": true
      }
    }
  },
  "nestedEntities": []
}
```

### Multiple Nested Arrays
```json
{
  "nestedEntities": [
    {
      "id": "posts",
      "relationshipType": "array",
      "propertyName": "posts"
    },
    {
      "id": "comments",
      "relationshipType": "array", 
      "propertyName": "comments"
    }
  ]
}
```

### Deep Nesting (Comments belong to Posts)
```json
{
  "nestedEntities": [
    {
      "id": "posts",
      "parentId": "user",
      "relationshipType": "array",
      "propertyName": "posts"
    },
    {
      "id": "comments",
      "parentId": "posts",
      "relationshipType": "array",
      "propertyName": "comments"
    }
  ]
}
```

## Validation Features

Enhanced JSON Mapping provides automatic validation that checks:

1. **Interface Compatibility**: Ensures SQL results match TypeScript interfaces
2. **Property Types**: Validates data types against schema definitions
3. **Required Fields**: Checks for missing required properties
4. **Extra Properties**: Identifies unexpected columns in SQL results
5. **Relationship Integrity**: Validates parent-child entity relationships

## Integration with Static Analysis

Enhanced JSON Mapping files enable comprehensive static analysis:

```typescript
import { runComprehensiveStaticAnalysis } from '@rawsql-ts/prisma-integration';

const report = await runComprehensiveStaticAnalysis({
  baseDir: __dirname,
  mappingDir: './sql',
  prismaClient,
  debug: false
});

// Validates Enhanced JSON Mapping against TypeScript interfaces
// Reports type mismatches, missing properties, and compatibility issues
```

## Troubleshooting

### Common Issues

1. **Type Validation Failures**: Check that SQL column types match TypeScript property types
2. **Missing Properties**: Ensure all required interface properties have corresponding SQL columns
3. **Relationship Errors**: Verify `parentId` references exist and `relationshipType` is correct
4. **Import Path Issues**: Confirm `importPath` points to valid TypeScript files

### Debug Tips

- Use `debug: true` in static analysis for detailed validation output
- Check that column aliases in SQL match `columns` mapping exactly
- Verify TypeScript interfaces are properly exported from import paths
- Ensure entity IDs are unique across the entire mapping file

This guide provides everything needed for AI tools and developers to create effective Enhanced JSON Mapping files that leverage full type safety and validation capabilities.
