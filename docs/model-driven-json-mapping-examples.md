# Model-Driven JSON Mapping Examples

## 🎯 Simple Field Mapping

For basic column mappings without type conversion:

```json
{
  "typeInfo": {
    "interface": "User",
    "importPath": "src/types/user.ts"
  },
  "structure": {
    "id": "user_id",
    "name": "user_name",
    "email": "email_address",
    "createdAt": "created_at"
  }
}
```

## 🔒 Type-Protected String Fields

For string fields that need type protection:

```json
{
  "typeInfo": {
    "interface": "User", 
    "importPath": "src/types/user.ts"
  },
  "structure": {
    "id": "user_id",
    "name": {
      "from": "user_name",
      "type": "string"
    },
    "email": {
      "from": "email_address", 
      "type": "string"
    },
    "createdAt": "created_at"
  }
}
```

## 🏗️ Nested Objects

```json
{
  "typeInfo": {
    "interface": "TodoWithUser",
    "importPath": "src/types/todo.ts"
  },
  "structure": {
    "id": "todo_id",
    "title": {
      "from": "title",
      "type": "string"
    },
    "user": {
      "type": "object",
      "from": "u",
      "structure": {
        "id": "user_id",
        "name": {
          "from": "user_name",
          "type": "string"
        }
      }
    }
  }
}
```

## 📚 Nested Arrays

```json
{
  "typeInfo": {
    "interface": "UserWithPosts",
    "importPath": "src/types/user.ts"
  },
  "structure": {
    "id": "user_id",
    "name": {
      "from": "user_name",
      "type": "string"
    },
    "posts": {
      "type": "array",
      "from": "p",
      "structure": {
        "id": "post_id",
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

## 🎨 Best Practices

### ✅ Do
- Use simple string mapping for IDs, timestamps, and numeric fields
- Use object mapping with `type: "string"` for text fields that might contain special characters
- Keep nested structures intuitive and mirror your TypeScript interfaces
- Use meaningful SQL table aliases in the `from` field

### ❌ Don't  
- Over-specify types for fields that don't need string protection
- Use deeply nested structures when a flatter design would be clearer
- Forget to specify `type: "string"` for user-input text fields

## 🔄 Migration from Legacy Format

### Old (Legacy)
```json
{
  "rootName": "user",
  "rootEntity": {
    "id": "user", 
    "name": "User",
    "columns": {
      "id": "user_id",
      "name": "user_name"
    }
  },
  "nestedEntities": [
    {
      "id": "posts",
      "name": "Post", 
      "parentId": "user",
      "propertyName": "posts",
      "relationshipType": "array",
      "columns": {
        "id": "post_id",
        "title": "post_title"
      }
    }
  ]
}
```

### New (Model-Driven)
```json
{
  "typeInfo": {
    "interface": "UserWithPosts",
    "importPath": "src/types/user.ts"
  },
  "structure": {
    "id": "user_id",
    "name": {
      "from": "user_name",
      "type": "string"
    },
    "posts": {
      "type": "array",
      "from": "p",
      "structure": {
        "id": "post_id", 
        "title": {
          "from": "post_title",
          "type": "string"
        }
      }
    }
  }
}
```

The new format is:
- 🎯 **More intuitive** - mirrors TypeScript interface structure
- 📝 **More readable** - less nesting and clearer relationships  
- ✨ **More concise** - simple mappings use string syntax
- 🔒 **Type-safe** - explicit string protection where needed
