# Git Workflow Standards

This document defines Git usage rules and standard workflows for the rawsql-ts project.

## Basic Principles

### Branch Strategy
- **Main branch**: `main`
- **Development branches**: Create feature-specific branches
- **Hotfix branches**: Emergency fix branches

### Commit Principles
- **Small and frequent commits**: Commit in logical units
- **Meaningful commits**: One change per commit
- **Quality assurance**: Always run quality checks before committing

## Commit Message Convention

### Basic Format (written in English)
```
type: brief description (50 characters or less)

Detailed explanation (if necessary)
- Reason for change
- Impact scope
- Notes

🤖 Generated with [Claude Code](https://claude.ai/code)

Co-Authored-By: Claude <noreply@anthropic.com>
```

### Type Classification
- `feat`: Add new feature
- `fix`: Bug fix
- `refactor`: Refactoring
- `docs`: Documentation changes
- `style`: Code style fixes (no functional impact)
- `test`: Add or modify tests
- `chore`: Build or configuration file changes

### Example
```bash
feat: add JOIN aggregation query decomposer

Implement functionality to separate JOIN operations from aggregation operations using CTEs
- Use SelectQueryParser for AST analysis
- Handle window function validation with proper error reporting
- Remove artificial JOIN limits for complex queries
- Performance improvement: enables easier debugging of complex queries

🤖 Generated with [Claude Code](https://claude.ai/code)

Co-Authored-By: Claude <noreply@anthropic.com>
```

## Development Workflow

### Prerequisites: worktree Environment
This project uses worktree for branch management:
- **Branch creation**: Created as worktree via command line
- **Claude Code startup**: Working branch is already configured
- **Work environment**: main branch and working branch are separated

### 1. Check Current Branch
```bash
# Check current branch (important)
git branch

# Work is prohibited if on main branch
# Confirm you're on a working branch before starting development
```

### 2. Development & Commit (Execute only on working branch)
```bash
# Check changes
git status
git diff

# Run quality checks (required)
tsc --noEmit
npm run lint
npm test

# Staging
git add .

# Commit
git commit -m "feat: add new SQL transformer functionality

Implement enhanced column reference conversion for CTE structures
- Handle complex aggregation expressions
- Add comprehensive test coverage
- Include error handling for edge cases

🤖 Generated with [Claude Code](https://claude.ai/code)

Co-Authored-By: Claude <noreply@anthropic.com>"
```

### 3. Push & Pull Request
```bash
# Push to remote
git push origin current-branch

# Create pull request (GitHub CLI)
gh pr create --title "Add SQL transformer functionality" --body "$(cat <<'EOF'
## Summary
Implement enhanced column reference conversion for CTE structures in SQL transformers

## Changes
- Add JoinAggregationDecomposer with dual API pattern
- Implement window function validation
- Add comprehensive test suite with real-world scenarios
- Remove artificial JOIN limits

## Testing
- [x] Unit tests executed (24/24 passing)
- [x] Integration tests confirmed
- [x] TypeScript compilation successful
- [x] All existing tests still pass

🤖 Generated with [Claude Code](https://claude.ai/code)
EOF
)"
```

## Quality Assurance

### Pre-commit Checks (Required)
```bash
# rawsql-ts specific quality checks
tsc --noEmit               # TypeScript errors: 0
npm run lint               # Lint errors: 0
npm test                   # Tests: all passing
npm run build              # Build: success
```

### Pre-pull Request Checks
```bash
# Merge latest main branch
git checkout main
git pull origin main
git checkout feature/branch-name
git merge main

# Run quality checks again after conflict resolution
tsc --noEmit && npm run lint && npm test && npm run build
```

## Merge Strategy

### Conflict Resolution Flow
Standard conflict resolution procedure when conflicts occur:

```bash
# 1. Commit once with conflicts present (record before resolution)
git add .
git commit -m "feat: implement SQL decomposer with merge conflicts

Note: This commit contains unresolved merge conflicts.
Will be resolved in the next commit.

🤖 Generated with [Claude Code](https://claude.ai/code)

Co-Authored-By: Claude <noreply@anthropic.com>"

# 2. Conflict resolution (AI-driven)
# - Auto-resolvable cases: AI provides and executes resolution
# - Difficult cases: Request user confirmation

# 3. Post-resolution commit (record resolution method in history)
git add .
git commit -m "fix: resolve merge conflicts in SQL parser integration

Resolution strategy:
- Kept current branch changes for JoinAggregationDecomposer logic
- Preserved main branch updates for SelectQueryParser enhancements
- Manual review required for overlapping test files

🤖 Generated with [Claude Code](https://claude.ai/code)

Co-Authored-By: Claude <noreply@anthropic.com>"
```

### AI-Driven Conflict Resolution
1. **Automatic resolution**: When clear priority exists
   - New feature vs old code → Adopt new feature
   - Format changes → Adopt unified style
   
2. **User confirmation**: When judgment is difficult
   - Business logic conflicts
   - Different implementation approaches
   - Data structure changes

### Pull Request Merging
- **History preservation**: Use regular merge to preserve conflict resolution history
- **Squash**: Limited to small fixes only
- **Transparency**: Preserve resolution process as history

### Post-merge Cleanup
```bash
# Automatic cleanup in worktree environment
# Manual deletion usually unnecessary
```

## Prohibited Actions

### Absolutely Forbidden
```bash
# ❌ Working on main branch (MOST IMPORTANT)
# If you have main branch open, stop work immediately
git branch  # → Work is prohibited if on main

# ❌ Force push (shared branches)
git push --force origin main  # Prohibited

# ❌ Commit without quality checks
git commit -m "temporary commit"  # Prohibited

# ❌ Meaningless commit messages
git commit -m "fix"           # Prohibited
git commit -m "update"        # Prohibited
git commit -m "WIP"           # Avoid
```

### worktree Environment Precautions
```bash
# ✅ Pre-work confirmation (required)
git branch | grep '^\*'  # Confirm current branch is working branch

# ❌ Working on main branch is absolutely prohibited
# → Work in different worktree directory or close project
```

### Patterns to Avoid
```bash
# ❌ Massive commits
git add . && git commit -m "massive changes"

# ❌ Modifying commit history (after sharing)
git rebase -i HEAD~5  # Avoid after sharing

# ❌ Committing binary files
git add *.log *.tmp  # Avoid
```

## Emergency Response

### Hotfix Procedure
```bash
# Create hotfix branch from main branch
git checkout main
git pull origin main
git checkout -b hotfix/critical-parser-bug-fix

# Fix and test
# Run quality checks

# Emergency merge
git checkout main
git merge hotfix/critical-parser-bug-fix
git push origin main

# Also apply to development branch
git checkout develop
git merge hotfix/critical-parser-bug-fix
git push origin develop
```

### Rollback Procedure
```bash
# Revert last commit
git revert HEAD

# Revert specific commit
git revert <commit-hash>

# Revert multiple commits
git revert HEAD~3..HEAD
```

## GitHub Integration

### Pull Request Template
```markdown
## Overview
Purpose and overview of this pull request

## Changes
- [ ] Add new feature (SQL transformer)
- [ ] Bug fix (parser error handling)
- [ ] Refactoring (code structure)
- [ ] Documentation update

## Testing
- [ ] Add/update unit tests
- [ ] Confirm integration tests
- [ ] Execute manual tests
- [ ] Performance tests (if applicable)

## Checklist
- [ ] TypeScript errors: 0
- [ ] Lint errors: 0
- [ ] Tests: all passing
- [ ] Build: success
- [ ] Documentation updated

## Related Issues
Closes #123
```

### Automation Setup
```yaml
# .github/workflows/pr-checks.yml
name: PR Quality Checks
on:
  pull_request:
    branches: [ main, develop ]

jobs:
  quality-check:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '18'
      - name: Install dependencies
        run: npm ci
      - name: TypeScript check
        run: tsc --noEmit
      - name: Lint check
        run: npm run lint
      - name: Test
        run: npm test
      - name: Build
        run: npm run build
```

## rawsql-ts Specific Best Practices

### Efficient Development
1. **Small branches**: Scope that can be completed in 1-3 days (e.g., single transformer implementation)
2. **Frequent commits**: Commit per transformer, parser, test
3. **Clear messages**: Clearly describe SQL processing changes
4. **Review-friendly size**: Around 200-400 lines per PR

### SQL-Related Change Management
1. **Parser changes**: Confirm no impact on existing query parsing
2. **Formatter changes**: Maintain output format consistency
3. **Transformer additions**: Avoid conflicts with existing transformation processes

### Security
1. **Exclude sensitive information**: Don't include actual data in test SQL strings
2. **Use .gitignore**: Properly exclude log files and temporary files
3. **History cleaning**: Completely remove accidentally committed sensitive information

## Troubleshooting

### Common Issues and Solutions

#### Merge Conflicts
```bash
# When conflict occurs
git merge main
# CONFLICT (content): Merge conflict in src/transformers/SqlFormatter.ts

# After manual resolution
git add src/transformers/SqlFormatter.ts
git commit -m "fix: resolve merge conflict in SqlFormatter

Preserved both upstream formatter enhancements and new indentation logic

🤖 Generated with [Claude Code](https://claude.ai/code)

Co-Authored-By: Claude <noreply@anthropic.com>"
```

#### Wrong Commit
```bash
# Modify last commit
git commit --amend -m "fix: correct SQL parser error handling

Handle malformed SELECT statements properly

🤖 Generated with [Claude Code](https://claude.ai/code)

Co-Authored-By: Claude <noreply@anthropic.com>"

# Add file and amend commit
git add forgotten-test-file.test.ts
git commit --amend --no-edit
```

#### Wrong Branch
```bash
# When committed to wrong branch
git log --oneline -n 5  # Check commit hash
git checkout correct-branch
git cherry-pick <commit-hash>
git checkout wrong-branch
git reset --hard HEAD~1  # Remove wrong commit
```

## Performance Optimization

### Efficiency in Large Repositories
```bash
# Shallow clone (CI environment)
git clone --depth 1 https://github.com/mk3008/rawsql-ts.git

# Fetch specific branch only
git fetch origin feature-branch:feature-branch
```

### File Size Management
```bash
# Manage large files with LFS (if needed)
git lfs track "*.test-data.json"
git add .gitattributes
```
