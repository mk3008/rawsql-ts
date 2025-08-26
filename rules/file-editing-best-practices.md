# File Editing Best Practices

## Critical Requirements

### Task Tool Agent Delegation Awareness
**IMPORTANT**: When using Task tool to call agents, understand the implementation behavior:

**Analysis-Only Agents** (NO file changes):
- `claude-code-advisor`: Provides tool/workflow recommendations only
- `retrospective-analyzer`: Records work history only (modifies .claude/work-history.md only)

**Implementation Agents** (WILL modify files):
- `dev-coordinator`, `qa-analyzer`: Delegate to specialists who implement
- `e2e-test-agent`: Creates/modifies test files
- `rule-organizer`: Modifies documentation/rule files

**Critical workflow**: Always run `git status` and `git diff` after Task tool calls to verify expected vs actual changes.

### Read Before Edit
**MANDATORY**: Always use the Read tool before Edit or MultiEdit. Claude Code requires reading the file first to establish context and line numbers.

```bash
# Required workflow
Read <file_path>     # MUST read first
Edit/MultiEdit       # Then edit
```

## Tool Selection Priority

### 1. MultiEdit (Strongly Preferred)
**When to use**: 
- Large code blocks (10+ lines)
- Multiple simultaneous edits
- Complex structural changes

**Advantages**:
- Exact string matching
- No escape characters needed
- Atomic guarantee for multiple edits

### 2. Edit
**When to use**:
- Medium-sized changes (1-10 lines)
- Unique string replacements
- Single location edits

**Advantages**:
- Simple and reliable
- String-based replacement

### 3. Write (New File Creation)
**When to use**:
- Creating brand new files
- Complete file replacement (rare)
- Initial file generation

**Important notes**:
- NEVER use Write to edit existing files (use Edit/MultiEdit)
- Always prefer editing existing files over creating new ones

### 4. replace_regex (Use Sparingly)
**When to use**:
- Only when pattern-based replacement is essential
- Small changes (1-2 lines)
- Batch replacement of similar patterns

**Important notes**:
```regex
# Required escape characters
\{ \} \* \( \) \? \+ \[ \] \. \^ \$ \|

# Multiline matching
[\s\S]*?  # Any character including newlines (.*? doesn't match newlines)

# Whitespace handling
\s*       # Zero or more whitespace characters
\s+       # One or more whitespace characters
```

## Edit Workflow

### 1. Pre-edit Verification
```bash
# Check target location
Read <file_path> <offset> <limit>
Grep <pattern> <file>
```

### 2. Execute Edit
```typescript
// MultiEdit example
{
  file_path: "/path/to/file",
  edits: [
    {
      old_string: "exact original string",
      new_string: "new string"
    }
  ]
}
```

### 3. Post-edit Validation
```bash
git diff <file>        # Verify changes
npm run typecheck      # Type checking
npm run build         # Build verification
```

## Common Pitfalls
- **Large block regex**: Use MultiEdit for 10+ lines (exact string matching)
- **Missing escapes**: Regex requires \{, \}, \*, \(, \), \?, \+
- **Multiline matching**: Use [\s\S]*? not .* 
- **React remounting**: Conditional components lose state, use conditional rendering within single component

## Quick Checklist

- [ ] Verified exact target string?
- [ ] Selected appropriate tool? (MultiEdit > Edit > regex)
- [ ] Escaped special characters properly? (regex only)
- [ ] Verified with git diff?
- [ ] Type check passes?
- [ ] Build succeeds?