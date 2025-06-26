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

## Test Strategy (t-wada Method)
Follow Test-Driven Development with these practices:

### 1. Red-Compile-Green-Refactor Cycle
- **Red**: Write failing test first (including bug reproduction tests)
- **Compile**: Ensure TypeScript compilation passes without errors
- **Green**: Write minimal code to make test pass
- **Refactor**: Improve code while keeping tests green

### 2. Humming Test
- Intentionally break tests to verify they actually test the behavior
- Change expected values temporarily to confirm test catches the change
- Ensures tests are not false positives

### 3. Triangulation
- Write multiple test cases to drive implementation
- Use different inputs/scenarios to guide the design
- Let tests reveal the true requirements through examples

### 4. Bug Reproduction
- For bugs: write failing test that reproduces the issue first
- Fix implementation until test passes
- Prevents regression of the same bug

### 5. Compilation First
- Always resolve TypeScript errors before proceeding to test execution
- Use `npm run build` to verify type safety before running tests
- Separate type definition issues from logic implementation issues

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
- For temporary files during debugging, use `.tmp/` folder
- Clean up all `.tmp/` folder contents after debugging is complete
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