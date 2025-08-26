# Git Workflow Standards

Core git usage rules and standard workflows for rawsql-ts project.

## Branch Strategy
- **Main branch**: `main` (protected)
- **Feature branches**: `feat/feature-name`, `fix/bug-name`
- **Hotfix branches**: `hotfix/critical-fix`

## Commit Format
```
type: brief description (≤50 chars)

Detailed explanation
- Reason for change
- Impact scope

🤖 Generated with [Claude Code](https://claude.ai/code)
Co-Authored-By: Claude <noreply@anthropic.com>
```

**Types**: feat, fix, refactor, docs, style, test, chore

## Development Workflow

### 1. Branch Check (REQUIRED)
```bash
git branch  # Must NOT be on main branch
```
**Why**: Working on main branch is absolutely prohibited

### 2. Quality Checks (REQUIRED)
```bash
tsc --noEmit && npm run lint && npm test
```
**Why**: Prevents broken commits and maintains code quality

### 3. Commit & Push
```bash
git add .
git commit -m "feat: implement SQL transformer

Add column reference conversion for CTE structures
- Handle complex aggregation expressions
- Include comprehensive test coverage

🤖 Generated with [Claude Code](https://claude.ai/code)
Co-Authored-By: Claude <noreply@anthropic.com>"

git push origin current-branch
```

### 4. Pull Request Creation
```bash
# Use explicit head flag for reliability
current_branch=$(git branch --show-current)
gh pr create --head $current_branch --title "Title" --body "Description"
```

## Merge Strategy

### Conflict Resolution
1. **Commit with conflicts** (record state)
2. **Resolve conflicts** (AI-assisted)  
3. **Commit resolution** (document method)

### Merge Types
- **Regular merge**: Preserve conflict resolution history
- **Squash**: Small fixes only

## Quality Gates

### Pre-commit (REQUIRED)
- TypeScript errors: 0
- Lint errors: 0  
- Tests: all passing
- Build: success

### Pre-PR (REQUIRED)
```bash
git checkout main && git pull origin main
git checkout feature-branch && git merge main
tsc --noEmit && npm run lint && npm test
```

## Emergency Procedures

### Hotfix Flow
```bash
git checkout main && git pull origin main
git checkout -b hotfix/critical-fix
# Fix, test, quality checks
git checkout main && git merge hotfix/critical-fix
git push origin main
```

### Rollback
```bash
git revert HEAD              # Last commit
git revert <commit-hash>     # Specific commit
```

## Specialized Rules
- **PR Creation Issues**: See `rules/pr-creation-troubleshooting.md`
- **Safety Rules & Prohibitions**: See `rules/git-safety-rules.md`