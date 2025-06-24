# Prisma Comparison Demo

## Setup
```bash
npm install
docker-compose up -d          # Start PostgreSQL
npm run db:setup             # Complete database setup
npm test                     # Run comparison demo
```

## Core Commands
```bash
npm run db:reset             # Reset database
npm run test:sql            # Validate SQL files
npm run build               # Compile TypeScript
```

## Features
- Side-by-side Prisma ORM vs rawsql-ts comparisons
- Performance analysis and SQL execution timing
- Cross-platform compatibility (Windows/Linux/WSL)
- Model-driven JSON mappings with hierarchical data
- SQL static analysis validation
- Generated analysis reports in `/reports/`

## File Structure
- `/rawsql-ts/` - SQL files with JSON mappings
- `/src/test-runners/` - Comparison implementations  
- `/prisma/` - Schema, seed data, Docker setup
- `/reports/` - Generated analysis reports

## Testing Requirements
- Unit tests are specifications - never change expected values without consultation
- Use AAA pattern, add tests for new features
- Always compile to check TypeScript errors
- Docker PostgreSQL required for integration tests

## Prerequisites
- Docker Desktop (for PostgreSQL)
- Node.js 18+
- DATABASE_URL configured in .env

## Common Issues
- Ensure Docker is running before starting tests
- Run `npx prisma generate` after schema changes
- Use `debug: true` in RawSqlClient for troubleshooting
- Check `/reports/` for detailed analysis results

## Windows/VS Code Environment Setup
**For VS Code Test Explorer compatibility:**

1. **Environment Variables Issue**: If tests fail with "Environment variable not found: DATABASE_URL"
   - Solution: Tests now automatically load `.env` file via dotenv
   - Alternative: Set `DATABASE_URL` in Windows environment variables
   - Fallback: vitest.config.ts includes default DATABASE_URL

2. **Docker on Windows**: Ensure Docker Desktop is running and WSL2 integration is enabled

3. **Test Explorer Schema Path Issue**: Fixed issue where VS Code Test Explorer runs from different working directory
   - Solution: Explicit schema path configuration in prisma-schema-resolver tests
   - Tests now work consistently from both command line and Test Explorer

4. **Path Issues**: All paths use cross-platform resolution for Windows compatibility

## Current Test Status
- **30/33 tests passing (91% pass rate)**
- Fixed import paths to use direct source code instead of npm packages
- Resolved PrismaClientType compatibility issues
- Fixed Test Explorer schema resolution problems