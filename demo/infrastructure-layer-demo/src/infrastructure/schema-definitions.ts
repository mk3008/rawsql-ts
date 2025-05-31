import { SchemaManager, TableDefinition } from 'rawsql-ts';

/**
 * Migrated schema definitions using rawsql-ts SchemaManager
 * This replaces the local unified-schema.ts with library-based implementation
 */

// === Table Definitions ===

export const todoTableDef: TableDefinition = {
    name: 'todo',
    columns: {
        todo_id: { name: 'todo_id', type: 'number', isPrimaryKey: true },
        title: { name: 'title', type: 'string', required: true },
        description: { name: 'description', type: 'string' },
        status: { name: 'status', type: 'string', required: true },
        priority: { name: 'priority', type: 'string' },
        category_id: { name: 'category_id', type: 'number' },
        created_at: { name: 'created_at', type: 'date', required: true, jsonAlias: 'todo_created_at' },
        updated_at: { name: 'updated_at', type: 'date', required: true, jsonAlias: 'todo_updated_at' }
    },
    relationships: [
        { type: 'belongsTo', table: 'category', foreignKey: 'category_id', propertyName: 'category' },
        { type: 'hasMany', table: 'todo_comment', foreignKey: 'todo_id', propertyName: 'comments' }
    ]
};

export const categoryTableDef: TableDefinition = {
    name: 'category',
    columns: {
        category_id: { name: 'category_id', type: 'number', isPrimaryKey: true },
        name: { name: 'name', type: 'string', required: true, jsonAlias: 'category_name' },
        description: { name: 'description', type: 'string', jsonAlias: 'category_description' },
        color: { name: 'color', type: 'string', jsonAlias: 'category_color' },
        created_at: { name: 'created_at', type: 'date', required: true, jsonAlias: 'category_created_at' }
    }
};

export const todoCommentTableDef: TableDefinition = {
    name: 'todo_comment',
    columns: {
        todo_comment_id: { name: 'todo_comment_id', type: 'number', isPrimaryKey: true },
        todo_id: { name: 'todo_id', type: 'number', required: true, jsonAlias: 'comment_todo_id' },
        content: { name: 'content', type: 'string', required: true, jsonAlias: 'comment_content' },
        author_name: { name: 'author_name', type: 'string', required: true, jsonAlias: 'comment_author_name' },
        created_at: { name: 'created_at', type: 'date', required: true, jsonAlias: 'comment_created_at' }
    },
    relationships: [
        { type: 'belongsTo', table: 'todo', foreignKey: 'todo_id', propertyName: 'todo' }
    ]
};

// === Schema Manager Instance ===

export const schemaManager = new SchemaManager({
    todo: todoTableDef,
    category: categoryTableDef,
    todo_comment: todoCommentTableDef
});

// === Backward Compatibility Functions ===

/**
 * Get table columns for SqlParamInjector (backward compatibility)
 */
export function getTableColumns(tableName: string): string[] {
    return schemaManager.getTableColumns(tableName);
}

/**
 * Create JSON mapping for PostgresJsonQueryBuilder (backward compatibility)
 */
export function createJsonMapping(tableName: string) {
    return schemaManager.createJsonMapping(tableName);
}
