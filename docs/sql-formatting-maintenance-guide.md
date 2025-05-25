# SQL Formatting Maintenance Guide

This document serves as a comprehensive guide for maintaining and extending SQL formatting functionality in the rawsql-ts library. It is designed to enable AI agents to work efficiently on formatting rule modifications.

## Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [Core Components](#core-components)
3. [Formatting Rule Implementation Patterns](#formatting-rule-implementation-patterns)
4. [Testing Strategy](#testing-strategy)
5. [Troubleshooting](#troubleshooting)
6. [Implementation Example: CASE Expression Formatting](#implementation-example-case-expression-formatting)

## Architecture Overview

The SQL formatting system consists of a 3-layer architecture:

```
SQL String → Parser → SqlPrintToken → Printer → Formatted SQL
```

### Data Flow
1. **Parser Layer**: Converts SQL strings into Abstract Syntax Trees (AST)
2. **Token Layer**: Transforms AST into formatting-specific token structures
3. **Printer Layer**: Converts tokens into actual formatted SQL strings

## Core Components

### 1. SqlPrintTokenParser
- **Location**: `src/parsers/SqlPrintTokenParser.ts`
- **Role**: AST → SqlPrintToken conversion
- **Key Responsibilities**:
  - Determining container types for each SQL element
  - Creating token structures that will be indented
  - Proper placement of keywords and spaces

### 2. SqlPrintToken
- **Location**: `src/models/SqlPrintToken.ts`
- **Role**: Intermediate data structure for formatting
- **Important Elements**:
  - `SqlPrintTokenType`: Token type (container, keyword, value, etc.)
  - `SqlPrintTokenContainerType`: Container type (used to determine formatting rules)

### 3. SqlPrinter
- **Location**: `src/transformers/SqlPrinter.ts`
- **Role**: Token → Formatted SQL conversion
- **Key Settings**:
  - `indentIncrementContainers`: Container types that trigger indentation
  - `newline`: Inline (`' '`) or multiline (`'\r\n'`) formatting
  - `indentChar`, `indentSize`: Indentation character and width

## Formatting Rule Implementation Patterns

### Pattern 1: Adding New Container Types

**Steps**:
1. Define new `SqlPrintTokenContainerType` in `SqlPrintToken.ts`
2. Apply container type to relevant elements in `SqlPrintTokenParser.ts`
3. Add to `indentIncrementContainers` in `SqlPrinter.ts` if indentation is needed

**Example**: CASE expression THEN/ELSE value containers
```typescript
// 1. Container type definition
export enum SqlPrintTokenContainerType {
    CaseThenValue = 'CaseThenValue',
    CaseElseValue = 'CaseElseValue',
    // ...
}

// 2. Parser application
const thenValueContainer = new SqlPrintToken(
    SqlPrintTokenType.container, 
    '', 
    SqlPrintTokenContainerType.CaseThenValue
);

// 3. Printer indentation setup
this.indentIncrementContainers = new Set([
    // ...
    SqlPrintTokenContainerType.CaseThenValue,
    SqlPrintTokenContainerType.CaseElseValue
]);
```

### Pattern 2: Conditional Indentation

**Important**: Indentation is only applied when `newline !== ' '`
```typescript
if (this.newline !== ' ' && current.text !== '' && this.indentIncrementContainers.has(token.containerType)) {
    innerLevel++;
    this.linePrinter.appendNewline(innerLevel);
}
```

### Pattern 3: Space and Keyword Placement

**Basic Rules**:
- Place appropriate spaces before and after keywords
- Add spaces before wrapping with containers

```typescript
// ✅ Correct example
token.innerTokens.push(SqlPrintTokenParser.SPACE_TOKEN);
token.innerTokens.push(new SqlPrintToken(SqlPrintTokenType.keyword, 'then'));
token.innerTokens.push(SqlPrintTokenParser.SPACE_TOKEN);
const valueContainer = new SqlPrintToken(/* ... */);
token.innerTokens.push(valueContainer);

// ❌ Incorrect example (missing spaces)
token.innerTokens.push(new SqlPrintToken(SqlPrintTokenType.keyword, 'then'));
const valueContainer = new SqlPrintToken(/* ... */);
token.innerTokens.push(valueContainer);
```

## Testing Strategy

### 1. Inline Format Testing
- Verify single-line display with `newline: ' '`
- Check for missing or extra spaces

### 2. Multiline Format Testing
- Verify multi-line display with `newline: '\r\n'`
- Confirm correct indentation hierarchy

### 3. Existing Test Updates
When adding new formatting rules, check and update these test files:
- `tests/SqlFormatter.case.test.ts`
- `tests/parsers/SqlPrintTokenParser.test.ts`
- `tests/parsers/SqlPrintTokenParser.simpleSelectQuery.test.ts`

## Troubleshooting

### Issue 1: Missing Spaces
**Symptoms**: Characters concatenate like `then2`
**Cause**: Missing spaces after keywords or before containers
**Solution**: Add `SqlPrintTokenParser.SPACE_TOKEN` at appropriate positions

### Issue 2: Excessive Indentation
**Symptoms**: Elements are indented more than expected
**Cause**: Unnecessary container types included in `indentIncrementContainers`
**Solution**: Remove the container type from `SqlPrinter.ts`

### Issue 3: Indentation in Inline Format
**Symptoms**: Multiline display even with `newline: ' '`
**Cause**: Indentation condition missing `newline !== ' '` check
**Solution**: Verify condition checks

## Implementation Example: CASE Expression Formatting

This section demonstrates the complete implementation flow using the actual CASE expression formatting implementation.

### Requirements
```sql
-- Previous (inline)
CASE WHEN condition THEN value ELSE value END

-- New specification (multiline)
, CASE
    WHEN condition THEN
      value
    ELSE
      value
  END AS alias
```

### Implementation Steps

#### Step 1: Container Type Definition
```typescript
// src/models/SqlPrintToken.ts
export enum SqlPrintTokenContainerType {
    CaseThenValue = 'CaseThenValue',
    CaseElseValue = 'CaseElseValue',
    // ...
}
```

#### Step 2: Parser Modification
```typescript
// src/parsers/SqlPrintTokenParser.ts
private visitCaseKeyValuePair(arg: CaseKeyValuePair): SqlPrintToken {
    const token = new SqlPrintToken(SqlPrintTokenType.container, '', SqlPrintTokenContainerType.CaseKeyValuePair);

    // WHEN clause
    token.innerTokens.push(new SqlPrintToken(SqlPrintTokenType.keyword, 'when'));
    token.innerTokens.push(SqlPrintTokenParser.SPACE_TOKEN);
    token.innerTokens.push(this.visit(arg.key));

    // THEN clause
    token.innerTokens.push(SqlPrintTokenParser.SPACE_TOKEN);
    token.innerTokens.push(new SqlPrintToken(SqlPrintTokenType.keyword, 'then'));
    
    // 🔑 Important: Wrap THEN value in container and add space before
    token.innerTokens.push(SqlPrintTokenParser.SPACE_TOKEN);
    const thenValueContainer = new SqlPrintToken(SqlPrintTokenType.container, '', SqlPrintTokenContainerType.CaseThenValue);
    thenValueContainer.innerTokens.push(this.visit(arg.value));
    token.innerTokens.push(thenValueContainer);

    return token;
}

private createElseToken(elseValue: SqlComponent): SqlPrintToken {
    const elseToken = new SqlPrintToken(SqlPrintTokenType.container, '', SqlPrintTokenContainerType.ElseClause);

    // ELSE keyword
    elseToken.innerTokens.push(new SqlPrintToken(SqlPrintTokenType.keyword, 'else'));
    
    // 🔑 Important: Wrap ELSE value in container and add space before
    elseToken.innerTokens.push(SqlPrintTokenParser.SPACE_TOKEN);
    const elseValueContainer = new SqlPrintToken(SqlPrintTokenType.container, '', SqlPrintTokenContainerType.CaseElseValue);
    elseValueContainer.innerTokens.push(this.visit(elseValue));
    elseToken.innerTokens.push(elseValueContainer);

    return elseToken;
}
```

#### Step 3: Printer Configuration
```typescript
// src/transformers/SqlPrinter.ts
this.indentIncrementContainers = new Set([
    // ...
    SqlPrintTokenContainerType.CaseThenValue,  // Indent THEN values
    SqlPrintTokenContainerType.CaseElseValue,  // Indent ELSE values
    // Note: CaseExpression is excluded (CASE keyword itself is not indented)
]);
```

#### Step 4: Test Updates
```typescript
// Example test expectation
expect(sql).toBe([
    '  , CASE',                    // CASE keyword at parent level
    '    WHEN condition THEN',     // WHEN at 1-level indent
    '      value',                 // THEN value at 2-level indent
    '    ELSE',                    // ELSE at 1-level indent
    '      value',                 // ELSE value at 2-level indent
    '  END AS alias'               // END at parent level
].join('\r\n'));
```

### 🔑 Key Points

1. **Container Type Granularity**: Create dedicated containers for elements requiring fine-grained control
2. **Space Placement**: Always place spaces between keywords and containers
3. **Indentation Target Selection**: Target actual child elements to be indented, not parent elements
4. **Test Compatibility**: Test both inline and multiline formats

## Summary

By following this document, you can efficiently add and modify SQL formatting rules. When new formatting requirements arise, refer to these patterns for implementation guidance.

---
*This document is updated regularly. Please add relevant sections when new formatting patterns are implemented.*
