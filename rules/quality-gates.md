# Quality Gates

Quality standards before commit/merge.

## Core Requirements
```bash
# All must pass before commit
tsc --noEmit              # TypeScript errors: 0
npm run lint              # ESLint errors: 0  
npm run test:run          # All tests passing
npm run build             # Build succeeds
```

## Standards

### File Size Limits (AI-Optimized)
**Why**: Large files are inefficient for AI tools to process and edit. AI performs best with focused, manageable file sizes that enable parallel processing and precise modifications.
- **React Components**: 300 lines maximum, 150 lines recommended
- **General TypeScript**: 300 lines recommended, 500 lines maximum  
- **Critical**: Files >800 lines require immediate refactoring (AI processing breaks down)
- **Exceptions**: Test files may exceed limits for comprehensive coverage

### Quality Standards
- TypeScript: Strict mode, zero errors (see `rules/common-typescript-patterns.md` for type safety patterns)
- ESLint: `@typescript-eslint/no-explicit-any: error`, `@typescript-eslint/ban-ts-comment: error`, `no-unused-vars: error`, `eqeqeq: always`

## Test & Build Standards
- Coverage: Core logic 90%+, ViewModels 85%+, utilities 80%+
- Build: <500KB main bundle, <2MB total, no warnings  
- Security: No secrets, eval(), regular `npm audit`

## SQL Processing Quality Gates (CRITICAL)

### SQL Code Quality Checks
**Why**: Prevents SQL processing regressions and file operation failures
**How**: All SQL processing changes must pass these additional checks
- [ ] **File Safety**: All fs.readFileSync/writeFileSync wrapped in try-catch
- [ ] **AST Parsing**: No regex/string manipulation for SQL parsing (only rawsql-ts AST)
- [ ] **Error Handling**: Specific error types (SqlParsingError, FileOperationError)
- [ ] **Implementation Complete**: No TODO comments in production SQL parsing code
- [ ] **CTE Processing**: Uses query.toSimpleQuery() for WITH clause handling

### SQL Processing Test Coverage
**Why**: SQL parsing is critical infrastructure requiring comprehensive testing
**How**: Additional coverage requirements for SQL processing files
- SQL parsing services: 95%+ coverage
- Error handling paths: 100% coverage
- File operation error cases: 100% coverage

## Pre-commit Checklist
```bash
# Standard checks
tsc --noEmit && npm run lint && npm run test:run && npm run build

# SQL processing specific checks
grep -r "TODO.*CRITICAL" src/core/services/sql-parser-service.ts && exit 1 # No critical TODOs
grep -r "fs\..*Sync.*(" src/ | grep -v "try\|catch" && exit 1 # File ops must have error handling
```

## Code Review Requirements
- [ ] TypeScript/ESLint/tests pass, file size limits, naming conventions
- [ ] Business logic tested, no security vulnerabilities, performance assessed
- [ ] **SQL Processing**: SQL quality gates pass, file operations safe, AST-based parsing only