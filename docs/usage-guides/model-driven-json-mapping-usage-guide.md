# Model-Driven JSON Mapping Usage Guide

This guide provides comprehensive instructions for creating Model-Driven JSON Mapping files that transform flat SQL results into structured, type-safe domain models. The Model-Driven JSON Mapping format offers an intuitive, TypeScript-model-centric approach to data transformation.

## Overview

Model-Driven JSON Mapping enables:
- **Intuitive Structure**: Direct mapping that mirrors TypeScript model structure
- **Type Safety**: Built-in type information and validation
- **Simplified Syntax**: Clean, readable mapping configuration
- **Automatic Detection**: Seamless integration with existing processing pipeline
- **Domain Model Integration**: Links SQL queries directly to TypeScript domain models

## Model-Driven JSON Mapping Structure

### Complete Example

```json
{
  "typeInfo": {
    "interface": "TodoDetail",
    "importPath": "src/contracts/todo-detail.ts"
  },
  "structure": {
    "todoId": "todo_id",
    "title": {
      "from": "title",
      "type": "string"
    },
    "description": {
      "from": "description",
      "type": "string"
    },
    "completed": "completed",
    "createdAt": "created_at",
    "updatedAt": "updated_at",
    "user": {
      "type": "object",
      "from": "u",
      "structure": {
        "userId": "user_id",
        "userName": {
          "from": "user_name",
          "type": "string"
        },
        "email": {
          "from": "email",
          "type": "string"
        }
      }
    },
    "category": {
      "type": "object",
      "from": "c",
      "structure": {
        "categoryId": "category_id",
        "categoryName": {
          "from": "category_name",
          "type": "string"
        },
        "color": {
          "from": "color",
          "type": "string"
        }
      }
    },
    "comments": {
      "type": "array",
      "from": "comments",
      "structure": {
        "commentId": "comment_id",
        "text": {
          "from": "comment_text",
          "type": "string"
        },
        "createdAt": "comment_created_at"
      }
    }
  },
  "protectedStringFields": [
    "title", "description", "user_name", "email", 
    "category_name", "color", "comment_text"
  ]
}
```

## Field Definitions

### Root Level Fields

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `typeInfo` | object | Yes | TypeScript interface information |
| `structure` | object | Yes | The main data structure mapping |
| `protectedStringFields` | array | No | List of database columns that should be protected with type: "string" |

### TypeInfo Object

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `interface` | string | Yes | TypeScript interface name |
| `importPath` | string | Yes | Path to import the interface from |

### Structure Mapping

The `structure` object maps TypeScript properties to database columns using two formats:

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
    "from": "database_column_name",
    "type": "string"
  }
}
```

### Nested Object Mapping
```json
{
  "nestedProperty": {
    "type": "object",
    "from": "table_alias",
    "structure": {
      "nestedField": "nested_column"
    }
  }
}
```

### Array Mapping
```json
{
  "arrayProperty": {
    "type": "array",
    "from": "array_alias",
    "structure": {
      "itemField": "item_column"
    }
  }
}
```

### Field Configuration Options

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `from` | string | Yes (for complex mappings) | Source database column or alias |
| `type` | string | No | Data type: "string", "number", "boolean", "object", "array" |
| `structure` | object | Yes (for objects/arrays) | Nested structure definition |

## Advantages Over Legacy Formats

### 1. Intuitive Structure
Model-driven format mirrors TypeScript interfaces:

**TypeScript Interface:**
```typescript
interface User {
  userId: number;
  profile: {
    name: string;
    email: string;
  };
}
```

**Model-Driven Mapping:**
```json
{
  "structure": {
    "userId": "user_id",
    "profile": {
      "type": "object",
      "from": "p",
      "structure": {
        "name": {
          "from": "profile_name",
          "type": "string"
        },
        "email": {
          "from": "profile_email",
          "type": "string"
        }
      }
    }
  }
}
```

### 2. Simplified Syntax
- No complex entity ID management
- Direct property-to-column mapping
- Clear nested structure representation

### 3. Better Readability
- Structure follows TypeScript model exactly
- Self-documenting field relationships
- Easier to understand and maintain

## Common Patterns

### Simple Entity (No Nesting)
```json
{
  "typeInfo": {
    "interface": "User",
    "importPath": "src/contracts/user.ts"
  },
  "structure": {
    "userId": "user_id",
    "name": {
      "from": "name",
      "type": "string"
    },
    "email": {
      "from": "email",
      "type": "string"
    },
    "createdAt": "created_at"
  },
  "protectedStringFields": [
    "name", "email"
  ]
}
```

### Single Nested Object
```json
{
  "typeInfo": {
    "interface": "UserProfile",
    "importPath": "src/contracts/user-profile.ts"
  },
  "structure": {
    "userId": "user_id",
    "name": {
      "from": "name",
      "type": "string"
    },
    "profile": {
      "type": "object",
      "from": "p",
      "structure": {
        "title": {
          "from": "profile_title",
          "type": "string"
        },
        "bio": {
          "from": "profile_bio",
          "type": "string"
        }
      }
    }
  }
}
```

### Multiple Nested Objects
```json
{
  "structure": {
    "todoId": "todo_id",
    "title": {
      "from": "title",
      "type": "string"
    },
    "user": {
      "type": "object",
      "from": "u",
      "structure": {
        "userId": "user_id",
        "userName": {
          "from": "user_name",
          "type": "string"
        }
      }
    },
    "category": {
      "type": "object",
      "from": "c",
      "structure": {
        "categoryId": "category_id",
        "name": {
          "from": "category_name",
          "type": "string"
        }
      }
    }
  }
}
```

### Array Relationships
```json
{
  "structure": {
    "userId": "user_id",
    "name": {
      "from": "name",
      "type": "string"
    },
    "posts": {
      "type": "array",
      "from": "posts",
      "structure": {
        "postId": "post_id",
        "title": {
          "from": "post_title",
          "type": "string"
        },
        "content": {
          "from": "post_content",
          "type": "string"
        }
      }
    }
  }
}
```

## String Field Protection

### Why Use Type Protection?

String fields in the database may return unexpected types due to:
- Database driver type conversion
- Numeric values stored as strings
- Date/timestamp formatting differences
- NULL value handling

### When to Use Type Protection

Use `type: "string"` for:
- User-generated content (titles, descriptions, names)
- Email addresses and usernames  
- Text-based identifiers
- Content that should always be treated as strings

### Example with Protection

```json
{
  "structure": {
    "title": {
      "from": "title",
      "type": "string"
    },
    "email": {
      "from": "email", 
      "type": "string"
    },
    "id": "user_id",  // Numbers don't need type protection
    "isActive": "is_active"  // Booleans don't need type protection
  }
}
```

## AI Generation Template

Use this template to prompt AI tools for generating Model-Driven JSON Mapping files:

### Prompt Template

```
Create a Model-Driven JSON Mapping file for transforming SQL results into the following TypeScript interface:

**TypeScript Interface:**
```typescript
[PASTE YOUR INTERFACE HERE]
```

**SQL Query:**
```sql
[PASTE YOUR SQL QUERY HERE]
```

**Requirements:**
- Use Model-Driven JSON Mapping format with typeInfo
- Map SQL column aliases to TypeScript property names exactly
- Use nested object structure for related entities
- Include type protection for string fields
- Follow the intuitive structure that mirrors the TypeScript interface

Please generate the complete JSON mapping file following the Model-Driven JSON Mapping specification.
```

### Example AI Prompt

```
Create a Model-Driven JSON Mapping file for transforming SQL results into the following TypeScript interface:

**TypeScript Interface:**
```typescript
interface UserProfile {
  userId: number;
  name: string;
  email: string;
  profile: {
    title: string;
    bio: string;
  };
  posts: Array<{
    postId: number;
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
- Use Model-Driven JSON Mapping format with typeInfo
- Map SQL column aliases to TypeScript property names exactly
- Use nested object structure for related entities
- Include type protection for string fields
- Follow the intuitive structure that mirrors the TypeScript interface

Please generate the complete JSON mapping file following the Model-Driven JSON Mapping specification.
```

## Best Practices

### 1. Structure Follows Interface
- Map the JSON structure to exactly match your TypeScript interface
- Use the same property names as in your TypeScript model
- Maintain the same nesting levels and object relationships

### 2. Consistent Naming
- Use camelCase for TypeScript property names
- Use snake_case for database column names
- Prefix related columns with table aliases for clarity

### 3. Type Safety
- Always include `typeInfo` with correct interface name and import path
- Use `type: "string"` for user-generated content
- Add `protectedStringFields` for security-sensitive columns

### 4. SQL Query Alignment
- Ensure SQL column aliases match the mapping exactly
- Use table aliases in SQL and reference them in `from` fields
- Structure JOINs to support the nested object hierarchy

## Migration from Legacy Formats

The Model-Driven format is automatically detected and converted by the MappingFileProcessor. Legacy formats are still supported but deprecated.

### Automatic Detection
The system automatically detects format based on structure:
- **Model-Driven**: Has `typeInfo` and `structure` fields
- **Unified**: Has `rootName` and `rootEntity` fields
- **Legacy**: Has `rootName` without `rootEntity`

### Migration Benefits
- **Improved Readability**: Structure mirrors TypeScript interfaces
- **Simplified Maintenance**: Easier to understand and modify
- **Better Type Safety**: Enhanced type information and validation
- **Future-Proof**: New features will prioritize model-driven format

## Integration with Static Analysis

Model-Driven JSON Mapping files enable comprehensive static analysis:

```typescript
import { runComprehensiveStaticAnalysis } from '@rawsql-ts/prisma-integration';

const report = await runComprehensiveStaticAnalysis({
  baseDir: __dirname,
  mappingDir: './sql',
  prismaClient,
  debug: false
});

// Validates Model-Driven JSON Mapping against TypeScript interfaces
// Reports type mismatches, missing properties, and compatibility issues
```

## Troubleshooting

### Common Issues

1. **Type Validation Failures**: Check that SQL column types match TypeScript property types
2. **Missing Properties**: Ensure all required interface properties have corresponding SQL columns
3. **Nested Structure Errors**: Verify `from` references exist and `structure` is correct
4. **Import Path Issues**: Confirm `importPath` points to valid TypeScript files

### Debug Tips

- Use `debug: true` in static analysis for detailed validation output
- Check that column aliases in SQL match mapping exactly
- Verify TypeScript interfaces are properly exported from import paths
- Ensure nested object `from` values match SQL table aliases

This guide provides everything needed for creating effective Model-Driven JSON Mapping files that leverage full type safety and intuitive structure design.
