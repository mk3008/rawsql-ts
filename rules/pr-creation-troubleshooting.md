# PR Creation Troubleshooting

Solutions for common GitHub CLI pull request creation failures.

## Core Issue Patterns

### 1. "aborted: you must first push the current branch to a remote"
**Why**: GitHub CLI cache/state issues with already-pushed branches
**How**: Use explicit branch specification
```bash
# Verify push status
git status
git log --oneline -n 1

# Use --head flag
gh pr create --head $(git branch --show-current) --title "Your PR Title"

# If not pushed
git push origin $(git branch --show-current)
gh pr create
```

### 2. "Warning: X uncommitted changes" Blocking PR Creation  
**Why**: Uncommitted files prevent PR creation even after successful push
**How**: Clean workspace before PR creation
```bash
git status

# Option A: Commit changes
git add . && git commit -m "fix: finalize changes"

# Option B: Stash temporarily  
git stash push -m "temporary stash for PR creation"

# Option C: Discard unwanted changes
git checkout -- . && git clean -fd

gh pr create
```

### 3. Multiple Retry Pattern for CLI Recognition
**Why**: GitHub CLI timing/synchronization issues with fresh branches
**How**: Reliable retry with verification
```bash
create_pr_reliable() {
    local title="$1"
    local body="${2:-Auto-generated PR}"
    local current_branch=$(git branch --show-current)
    
    # Verify not on main
    if [ "$current_branch" = "main" ]; then
        echo "❌ Cannot create PR from main branch"
        return 1
    fi
    
    # Clean workspace check
    if [ -n "$(git status --porcelain)" ]; then
        echo "❌ Uncommitted changes detected. Clean workspace first."
        return 1
    fi
    
    # Ensure pushed
    local local_commit=$(git rev-parse HEAD)
    local remote_commit=$(git rev-parse origin/$current_branch 2>/dev/null || echo "missing")
    
    if [ "$local_commit" != "$remote_commit" ]; then
        git push origin $current_branch
        sleep 2
    fi
    
    # Create PR with explicit head
    gh pr create --head "$current_branch" --title "$title" --body "$body"
}

# Usage
create_pr_reliable "feat: add SQL transformer" "Description here"
```

### 4. Standard --head Flag Workaround
**Why**: Default `gh pr create` fails but `--head` flag works consistently
**How**: Always use explicit branch specification
```bash
# ❌ Unreliable
gh pr create --title "Title"

# ✅ Reliable  
current_branch=$(git branch --show-current)
gh pr create --head $current_branch --title "Title" --body "Description"
```

## Complete Reliable Workflow

```bash
reliable_pr_workflow() {
    local current_branch=$(git branch --show-current)
    
    # Step 1: Branch validation
    if [ "$current_branch" = "main" ]; then
        echo "❌ Cannot create PR from main branch"
        return 1
    fi
    
    # Step 2: Workspace cleanliness  
    if [ -n "$(git status --porcelain)" ]; then
        echo "❌ Uncommitted changes found. Clean workspace first."
        git status
        return 1
    fi
    
    # Step 3: Push verification
    local local_commit=$(git rev-parse HEAD)  
    local remote_commit=$(git rev-parse origin/$current_branch 2>/dev/null || echo "")
    
    if [ "$local_commit" != "$remote_commit" ]; then
        git push origin $current_branch
        sleep 2
    fi
    
    # Step 4: PR creation
    local title="$1"
    local body="${2:-Auto-generated PR body}"
    
    if gh pr create --head "$current_branch" --title "$title" --body "$body"; then
        echo "✅ PR created successfully!"
        return 0
    else
        echo "❌ PR creation failed"
        echo "Manual fallback: Use GitHub web interface"
        return 1
    fi
}

# Usage
reliable_pr_workflow "feat: add transformer" "Description"
```