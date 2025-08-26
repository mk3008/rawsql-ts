# Git Safety Rules

Critical safety rules and prohibited actions for git operations.

## Absolutely Forbidden

### Working on Main Branch (MOST CRITICAL)
```bash
git branch  # Check current branch
# If output shows "* main" → STOP ALL WORK
```
**Why**: Main branch is protected; changes must go through PR process
**How**: Switch to feature branch or close project immediately

### Force Push to Shared Branches  
```bash
# ❌ NEVER do this
git push --force origin main
git push --force origin develop
```
**Why**: Destroys commit history and breaks other developers' work
**How**: Use `git revert` instead for corrections

### Commits Without Quality Checks
```bash
# ❌ NEVER do this
git commit -m "temporary commit" --no-verify
git add . && git commit -m "fix" 
```
**Why**: Breaks build, introduces bugs, pollutes history
**How**: Always run `tsc --noEmit && npm run lint && npm test` first

### Meaningless Commit Messages
```bash
# ❌ Prohibited patterns
git commit -m "fix"
git commit -m "update" 
git commit -m "WIP"
git commit -m "changes"
```
**Why**: Makes code history unusable for debugging and review
**How**: Use descriptive format: `type: what changed and why`

## worktree Environment Precautions

### Pre-work Branch Confirmation (REQUIRED)
```bash
# ✅ Required before any work
git branch | grep '^\*'  # Must show feature branch, not main

# ❌ If on main branch
# → Switch to different worktree directory or close project
```

### Safe Branch Operations
```bash
# ✅ Create feature branch
git checkout -b feat/feature-name

# ✅ Switch between feature branches  
git checkout feat/other-feature

# ❌ NEVER checkout main for development work
```

## Patterns to Avoid

### Massive Commits
```bash
# ❌ Anti-pattern
git add . && git commit -m "massive refactor with 50 file changes"
```
**Why**: Impossible to review, debug, or revert granularly
**How**: Commit logical units: one feature/fix per commit

### History Modification After Sharing
```bash
# ❌ Dangerous after push
git rebase -i HEAD~5
git commit --amend (on shared commits)
```
**Why**: Breaks other developers' branches and causes conflicts
**How**: Use forward fixes with new commits

### Binary Files in Repository
```bash
# ❌ Avoid committing
git add *.log *.tmp *.cache
```
**Why**: Bloats repository, causes merge conflicts
**How**: Use proper `.gitignore` and clean untracked files

## Merge Conflict Safety

### Safe Resolution Process
```bash
# 1. Always commit with conflicts first (record state)
git add . && git commit -m "feat: new feature with merge conflicts

Note: Unresolved conflicts, will fix in next commit"

# 2. Resolve conflicts with AI assistance
# 3. Commit resolution with explanation
git add . && git commit -m "fix: resolve merge conflicts

Resolution: Kept feature branch logic, preserved main updates"
```
**Why**: Preserves conflict resolution history for debugging

### Conflict Resolution Guidelines
- **Auto-resolve**: Clear priority cases (new feature vs old code)
- **User confirmation**: Business logic conflicts, structural changes
- **Document decisions**: Always explain resolution reasoning

## Emergency Safety Procedures

### Wrong Branch Fix
```bash
# When committed to wrong branch
git log --oneline -n 1  # Get commit hash
git checkout correct-branch
git cherry-pick <commit-hash>
git checkout wrong-branch  
git reset --hard HEAD~1  # Remove from wrong branch
```

### Accidental Main Branch Work
```bash
# If you accidentally worked on main
git stash push -m "emergency stash"
git checkout -b emergency-feature-branch
git stash pop
# Continue work on feature branch
```

### Clean Untracked Files
```bash
# Safe cleanup
git clean -n  # Preview what will be deleted
git clean -fd # Remove untracked files and directories
```
**Why**: Prevents accidental commit of temporary/generated files