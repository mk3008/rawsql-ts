# PostgreSQL JSON Query Builder Maintenance Guide

This document serves as a comprehensive guide for maintaining and extending PostgreSQL JSON query building functionality in the rawsql-ts library. It is designed to enable AI agents to work efficiently on JSON mapping and CTE-based query transformation modifications.

## Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [Core Components](#core-components)
3. [JSON Mapping Implementation Patterns](#json-mapping-implementation-patterns)
4. [CTE Builder Integration](#cte-builder-integration)
5. [Testing Strategy](#testing-strategy)
6. [Troubleshooting](#troubleshooting)
7. [Implementation Example: Adding New Relationship Types](#implementation-example-adding-new-relationship-types)

## Architecture Overview

The PostgreSQL JSON Query Builder consists of a 3-layer CTE-based architecture:

```
SimpleSelectQuery → CTE Strategy → JSON Result
```

### Data Flow
1. **Validation Layer**: Validates JSON mapping against original query
2. **CTE Generation Layer**: Creates hierarchical CTEs for object and array entities
3. **Final Query Layer**: Builds the final SELECT query with JSON aggregation

### CTE Processing Order
```
Initial CTE → Object Entity CTEs → Array Entity CTEs → Final JSON Query
```

## Core Components

### 1. PostgresJsonQueryBuilder
- **Location**: `src/transformers/PostgresJsonQueryBuilder.ts`
- **Role**: Main orchestrator for JSON query transformation
- **Key Responsibilities**:
  - JSON mapping validation
  - CTE strategy coordination
  - Final query construction

### 2. PostgresObjectEntityCteBuilder
- **Location**: `src/transformers/PostgresObjectEntityCteBuilder.ts`
- **Role**: Handles object relationship CTEs (formerly parent entities)
- **Key Features**:
  - Depth-based processing (deepest first)
  - NULL handling for outer joins
  - Column compression operations

### 3. PostgresArrayEntityCteBuilder
- **Location**: `src/transformers/PostgresArrayEntityCteBuilder.ts`
- **Role**: Handles array relationship CTEs
- **Key Features**:
  - Row compression using GROUP BY
  - JSON array aggregation
  - Hierarchical dependency resolution

### 4. JsonMapping Interface
- **Location**: `src/transformers/PostgresJsonQueryBuilder.ts` (lines 6-20)
- **Role**: Configuration structure for JSON transformation
- **Key Properties**:
  - `rootEntity`: Root object definition
  - `nestedEntities`: Child entities with relationship types
  - `relationshipType`: "object" or "array"

## JSON Mapping Implementation Patterns

### Pattern 1: Basic Entity Structure

**Entity Definition**:
```typescript
interface ProcessableEntity {
    id: string;              // Unique identifier
    name: string;            // Entity name for JSON column naming
    columns: { [jsonKey: string]: string };  // JSON key to SQL column mapping
    isRoot: boolean;         // Whether this is the root entity
    propertyName: string;    // Property name in parent JSON
    parentId?: string;       // Parent entity ID (for nested entities)
    relationshipType?: "object" | "array";  // Relationship type
}
```

### Pattern 2: Relationship Type Mapping

**Object Relationships (0..1)**:
- Processed by `PostgresObjectEntityCteBuilder`
- Uses column compression
- Creates JSON objects with NULL handling
- Example: Customer → Address

**Array Relationships (1..N)**:
- Processed by `PostgresArrayEntityCteBuilder`
- Uses row compression with GROUP BY
- Creates JSON arrays with aggregation
- Example: Order → OrderItems

### Pattern 3: Depth-Based Processing

**Depth Calculation**:
```typescript
const getDepth = (entityId: string): number => {
    const entity = allEntities.get(entityId);
    if (!entity || entity.isRoot) return 0;
    if (!entity.parentId) return 1;
    return 1 + getDepth(entity.parentId);
};
```

**Processing Order**: Deepest → Shallowest
- Ensures dependencies are resolved before entity processing
- Allows parallel processing at same depth levels

## CTE Builder Integration

### Integration Flow in PostgresJsonQueryBuilder

```typescript
// Step 1: Create initial CTE
const { initialCte, initialCteAlias } = this.createInitialCte(originalQuery);

// Step 2: Process object entities (object relationships)
const objectEntityResult = this.objectEntityCteBuilder.buildObjectEntityCtes(
    initialCte, allEntities, mapping
);

// Step 3: Process array entities (array relationships)
const arrayCteBuildResult = this.arrayEntityCteBuilder.buildArrayEntityCtes(
    objectEntityResult.ctes, objectEntityResult.lastCteAlias, allEntities, mapping
);

// Step 4: Build final JSON query
return this.buildFinalSelectQuery(
    arrayCteBuildResult.updatedCtes, arrayCteBuildResult.lastCteAlias, allEntities, mapping
);
```

### CTE Naming Conventions

**Object Entity CTEs**: `cte_object_depth_N`
**Array Entity CTEs**: `cte_array_depth_N`
**Initial CTE**: `origin_query`
**Root Object CTE**: `cte_root_[rootName]`

## Testing Strategy

### 1. Mapping Validation Testing
- Test invalid column references
- Test circular dependencies
- Test multiple array children violations
- Test duplicate property names

### 2. Object Entity Processing Testing
- Test NULL handling in outer joins
- Test nested object hierarchies
- Test depth-based processing order

### 3. Array Entity Processing Testing
- Test JSON array aggregation
- Test GROUP BY operations
- Test nested array hierarchies

### 4. Integration Testing
- Test complete JSON transformation
- Test mixed object/array relationships
- Test complex hierarchical structures

### 5. Key Test Files
- `tests/transformers/hierarchical/PostgresJsonQueryBuilder.ParentCTE.test.ts`
- `tests/transformers/hierarchical/ComplexHierarchyBuilder.test.ts`
- `tests/transformers/hierarchical/GroupedHierarchyBuilder.test.ts`
- `tests/transformers/hierarchical/SimpleHierarchyBuilder.test.ts`

## Troubleshooting

### Issue 1: Invalid Column References
**Symptoms**: Validation errors about missing columns
**Cause**: JSON mapping references columns not available in original query
**Solution**: Verify `SelectValueCollector` output matches mapping column references

### Issue 2: Circular Dependencies
**Symptoms**: Stack overflow or infinite loops during depth calculation
**Cause**: Entities reference each other in parent-child relationships
**Solution**: Add cycle detection in depth calculation functions

### Issue 3: CTE Naming Conflicts
**Symptoms**: SQL execution errors about duplicate CTE names
**Cause**: CTE naming collisions between depth levels or builders
**Solution**: Verify CTE naming conventions and depth-based uniqueness

### Issue 4: Incorrect JSON Structure
**Symptoms**: Wrong nesting or missing relationships in output
**Cause**: Incorrect relationship type assignment or processing order
**Solution**: Verify relationship types and depth-based processing sequence

### Issue 5: NULL Handling Issues
**Symptoms**: Empty objects instead of NULL for missing relationships
**Cause**: Missing NULL checks in object entity processing
**Solution**: Ensure proper CASE expressions with NULL conditions

## Implementation Example: Adding New Relationship Types

This section demonstrates how to add a new relationship type to the system.

### Requirements
Suppose we want to add a new "map" relationship type that creates JSON objects with dynamic keys.

### Implementation Steps

#### Step 1: Update JsonMapping Interface
```typescript
// src/transformers/PostgresJsonQueryBuilder.ts
export interface JsonMapping {
    // ...existing properties...
    nestedEntities: Array<{
        // ...existing properties...
        relationshipType?: "object" | "array" | "map";  // Add new type
        keyColumn?: string;  // For map type: column that provides keys
    }>;
}
```

#### Step 2: Create New CTE Builder
```typescript
// src/transformers/PostgresMapEntityCteBuilder.ts
export class PostgresMapEntityCteBuilder {
    private static readonly CTE_MAP_PREFIX = 'cte_map_depth_';
    
    public buildMapEntityCtes(
        ctesSoFar: CommonTable[],
        aliasOfCteToBuildUpon: string,
        allEntities: Map<string, ProcessableEntity>,
        mapping: JsonMapping
    ): { updatedCtes: CommonTable[], lastCteAlias: string } {
        // Implementation for map entity processing
        // Similar to array entities but with json_object_agg instead of json_agg
    }
}
```

#### Step 3: Update Main Builder Integration
```typescript
// src/transformers/PostgresJsonQueryBuilder.ts
export class PostgresJsonQueryBuilder {
    private mapEntityCteBuilder: PostgresMapEntityCteBuilder;
    
    constructor() {
        // ...existing builders...
        this.mapEntityCteBuilder = new PostgresMapEntityCteBuilder();
    }
    
    private buildJsonWithCteStrategy(/* ... */): SimpleSelectQuery {
        // ...existing steps...
        
        // Step 3.5: Build CTEs for map entities
        const mapCteBuildResult = this.mapEntityCteBuilder.buildMapEntityCtes(
            arrayCteBuildResult.updatedCtes,
            arrayCteBuildResult.lastCteAlias,
            allEntities,
            mapping
        );
        
        // Continue with final query building...
    }
}
```

#### Step 4: Update Validation Logic
```typescript
// Add validation for map-specific requirements
private validateMapping(query: SimpleSelectQuery, mapping: JsonMapping): void {
    // ...existing validation...
    
    // Validate map entities
    mapping.nestedEntities.forEach(entity => {
        if (entity.relationshipType === "map") {
            if (!entity.keyColumn) {
                throw new Error(`Map entity ${entity.id} must specify keyColumn`);
            }
            // Validate keyColumn exists in available columns
        }
    });
}
```

#### Step 5: Add Tests
```typescript
// tests/transformers/hierarchical/MapEntityBuilder.test.ts
describe('PostgresMapEntityCteBuilder', () => {
    it('should create JSON object with dynamic keys', () => {
        // Test map entity processing
    });
    
    it('should handle empty map relationships', () => {
        // Test NULL handling for maps
    });
});
```

### 🔑 Key Points for New Relationship Types

1. **Consistency**: Follow existing naming conventions and patterns
2. **Depth Processing**: Ensure proper depth-based ordering
3. **CTE Integration**: Maintain CTE chain integrity
4. **Validation**: Add appropriate validation rules
5. **Testing**: Comprehensive test coverage for new functionality

## Summary

The PostgreSQL JSON Query Builder follows a structured, CTE-based approach to transform relational data into hierarchical JSON structures. When extending functionality:

1. **Understand the CTE Flow**: Each builder adds to the CTE chain
2. **Follow Naming Conventions**: Consistent naming across all components
3. **Maintain Depth Ordering**: Process dependencies before dependents
4. **Validate Thoroughly**: Catch configuration errors early
5. **Test Comprehensively**: Cover both success and error scenarios

By following this document, you can efficiently add and modify JSON query building functionality. When new requirements arise, refer to these patterns for implementation guidance.

---
*This document is updated regularly. Please add relevant sections when new JSON mapping patterns are implemented.*
