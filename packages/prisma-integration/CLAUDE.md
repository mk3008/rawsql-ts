# rawsql-ts Prisma Integration

## Commands
```bash
npm test              # Run tests
npm run build         # Build TypeScript
npm run lint          # ESLint
npm run typecheck     # TypeScript check
```

## Core API
```typescript
import { RawSqlClient } from '@msugiura/rawsql-prisma';

const client = new RawSqlClient(prisma, {
    sqlFilesPath: './sql',
    debug: true
});

// Single result with JSON mapping
const user = await client.queryOne<User>('getUser.sql', { id: 1 });

// Multiple results
const users = await client.queryMany<User>('listUsers.sql', { active: true });
```

## Key Features
- Cross-platform path resolution (Windows/Linux/WSL)
- Automatic JSON mapping file resolution
- Multiple JSON mapping formats (Legacy, Enhanced, Model-Driven, Unified)
- SQL validation against Prisma schema
- Enhanced error handling with specific error classes
- File caching for performance
- Debug mode with detailed logging

## Testing Requirements
- Unit tests are specifications - never change expected values without consultation
- Use AAA pattern
- Add tests for new features
- Run tests after fixes to prevent regressions
- Use `SqlFormatter` for SQL comparison tests
- Always compile to check for TypeScript errors

## Error Classes
- `SqlFileNotFoundError` - SQL file not found
- `JsonMappingError` - JSON mapping issues  
- `JsonMappingRequiredError` - Missing JSON mapping
- `SqlExecutionError` - SQL execution failures

## Common Issues
- Enable `debug: true` for troubleshooting
- JSON mapping required for `queryOne()`/`queryMany()` 
- Use `npx prisma generate` after schema changes
- Avoid hardcoded Windows paths - use relative paths
- Check `sqlFilesPath` configuration if files not found