# rawsql-ts Core Package

## Commands
```bash
npm test              # Run tests  
npm run build         # TypeScript build
npm run lint          # ESLint
```

## Critical Rules
- Unit tests are specifications - never change expected values without consultation
- Add test when adding/fixing features
- Always compile to check TypeScript errors
- Use `SqlFormatter` for SQL comparison tests

## JSON Mapping Conversion
```typescript
// Model-Driven format
import { convertModelDrivenMapping } from 'rawsql-ts';
const result = convertModelDrivenMapping(mapping);

// Format detection
if (mapping.typeInfo && mapping.structure) { /* Model-Driven */ }
if (mapping.rootName && mapping.rootEntity) { /* Legacy */ }
```

## Common Errors
- `Cannot read properties of undefined (reading 'columns')` → Use `convertModelDrivenMapping`
- Module not found → `npm run build` first
- Use package imports: `import { X } from 'rawsql-ts'`

## Development Principles
1. Solve one problem completely before next
2. Prioritize maintainability over micro-optimizations  
3. Keep tasks small and focused
4. When requirements overlap → consider separation, suggest `git worktree add ../branch feature/fix`

## Debugging Guidelines
- Use `__tmp__` prefix for temporary debugging files (e.g., `__tmp__debug.test.ts`)
- Clean up all `__tmp__` files after debugging is complete
- Remove debug console.log statements before committing

## Troubleshooting: Code Changes Not Reflecting
**When your code changes don't appear in tests/execution:**

1. **Check import sources first**
   ```typescript
   // ❌ Old npm package (cached/outdated)
   import { X } from 'rawsql-ts';
   
   // ✅ Direct source (latest changes)
   import { X } from '../../core/src/index';
   ```

2. **Clear build artifacts**
   ```bash
   rm -rf dist node_modules
   npm run build
   ```

3. **Add debug logs to verify code path**
   ```typescript
   console.log('🔍 [ClassName] method called'); // Verify execution
   ```

4. **In monorepos: npm packages vs file: references**
   - `file:../packages/core` still uses built `dist/` files
   - Direct src imports bypass build/cache issues