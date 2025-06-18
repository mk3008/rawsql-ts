# Type Transformation Post-Processor

A zero-dependency utility for transforming JSON-ified SQL results back to proper TypeScript types. Especially useful for handling PostgreSQL results where dates become strings and BigInts lose precision during JSON serialization.

## Features

- 🔄 **Automatic date string to Date object conversion**
- 🔢 **BigInt string/number to BigInt conversion**
- 🛠️ **Customizable transformation rules**
- 🎯 **Column-specific transformations**
- 🔧 **Custom transformer functions**
- ⚡ **Zero dependencies**
- 🧩 **Framework agnostic**

## Quick Start

```typescript
import { transformDatabaseResult, TypeTransformationPostProcessor } from 'rawsql-ts';

// Simple usage - transforms common PostgreSQL types automatically
const rawResult = {
  id: 1,
  created_at: "2024-01-15T10:30:00.000Z", // String from JSON
  updated_at: "2024-01-15T10:30:00.000Z", // String from JSON
  count: "12345678901234567890" // Large number as string
};

const transformed = transformDatabaseResult(rawResult);
console.log(transformed.created_at instanceof Date); // true
console.log(typeof transformed.count === 'bigint'); // true
```

## Advanced Usage

### Custom Configuration

```typescript
import { TypeTransformationPostProcessor } from 'rawsql-ts';

const processor = new TypeTransformationPostProcessor({
  globalTransformations: {
    'TIMESTAMP': {
      sourceType: 'TIMESTAMP',
      targetType: 'Date',
      handleNull: true,
      validator: (value) => typeof value === 'string' && !isNaN(Date.parse(value))
    }
  },
  columnTransformations: {
    'special_field': {
      sourceType: 'custom',
      targetType: 'custom',
      customTransformer: 'toUpperCase'
    }
  },
  customTransformers: {
    'toUpperCase': (value: string) => value.toUpperCase()
  }
});

const result = processor.transformResult(data);
```

### With Real Database Results

```typescript
// Example with a complex nested SQL result
const sqlResult = [
  {
    user: {
      userId: 1,
      createdAt: "2024-01-15T10:30:00.000Z" // Will be converted to Date
    },
    posts: [
      {
        postId: "12345678901234567890", // Will be converted to BigInt if detected
        publishedAt: "2024-01-15T10:30:00.000Z" // Will be converted to Date
      }
    ]
  }
];

// Transform the entire nested structure
const transformed = transformDatabaseResult(sqlResult);
```

## Default Transformations

The processor includes these default transformations:

| Type | From | To | Detection |
|------|------|----|----|
| DATE/TIMESTAMP | String | Date | ISO 8601 format strings |
| BIGINT | String/Number | BigInt | Numbers > MAX_SAFE_INTEGER or 16+ digit strings |

## Column-Specific Transformations

You can specify transformations for specific column names:

```typescript
const processor = new TypeTransformationPostProcessor({
  columnTransformations: {
    'user_id': {
      sourceType: 'BIGINT',
      targetType: 'bigint',
      handleNull: true
    },
    'metadata': {
      sourceType: 'JSONB',
      targetType: 'object',
      handleNull: true
    }
  }
});
```

## Custom Transformers

Create your own transformation functions:

```typescript
const processor = new TypeTransformationPostProcessor({
  customTransformers: {
    'parseJson': (value: string) => JSON.parse(value),
    'toUpperCase': (value: string) => value.toUpperCase(),
    'parseNumber': (value: string) => parseFloat(value)
  },
  columnTransformations: {
    'config_json': {
      sourceType: 'custom',
      targetType: 'custom',
      customTransformer: 'parseJson'
    }
  }
});
```

## Error Handling

The processor includes built-in error handling and will log warnings for failed transformations while returning the original value:

```typescript
// Invalid date strings are handled gracefully
const result = transformDatabaseResult({
  invalid_date: "not-a-date", // Remains as string
  valid_date: "2024-01-15T10:30:00.000Z" // Converted to Date
});
```

## Integration Examples

### With Raw SQL Clients

```typescript
import { RawSqlClient } from 'your-sql-client';
import { transformDatabaseResult } from 'rawsql-ts';

const client = new RawSqlClient(connection);
const rawResult = await client.query('SELECT * FROM users WHERE id = ?', [1]);
const transformedResult = transformDatabaseResult(rawResult);
```

### With Custom Types

```typescript
interface User {
  id: number;
  createdAt: Date; // Will be properly typed as Date after transformation
  metadata: object;
}

const result = transformDatabaseResult<User[]>(sqlResult);
```

## API Reference

### `transformDatabaseResult<T>(result: any, config?: TypeTransformationConfig): T`
Convenience function that creates a processor with default or custom config and transforms the result.

### `TypeTransformationPostProcessor`
Main class for handling type transformations.

#### Methods
- `transformResult<T>(result: any): T` - Transform a single result
- `static createDefaultConfig(): TypeTransformationConfig` - Get default configuration

### Types

```typescript
interface TypeTransformationConfig {
  columnTransformations?: { [columnName: string]: TypeTransformation };
  globalTransformations?: { [sqlType: string]: TypeTransformation };
  customTransformers?: { [transformerName: string]: (value: any) => any };
}

interface TypeTransformation {
  sourceType: 'DATE' | 'TIMESTAMP' | 'BIGINT' | 'NUMERIC' | 'JSONB' | 'custom';
  targetType: 'Date' | 'bigint' | 'string' | 'number' | 'object' | 'custom';
  customTransformer?: string;
  handleNull?: boolean;
  validator?: (value: any) => boolean;
}
```

## Performance Considerations

- Transformations are applied recursively to nested objects and arrays
- Built-in caching for repeated transformations
- Minimal overhead for non-matching values
- No external dependencies

## License

MIT
