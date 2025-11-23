import { SqlComponent } from "../models/SqlComponent";
import { CreateTableQuery, TableColumnDefinition, ColumnConstraintDefinition, TableConstraintDefinition } from "../models/CreateTableQuery";
import { AlterTableStatement, AlterTableAddConstraint } from "../models/DDLStatements";
import { QualifiedName, IdentifierString } from "../models/ValueComponent";

export class DDLGeneralizer {
    /**
     * Generalizes DDL statements by moving constraints from CREATE TABLE to ALTER TABLE statements.
     * This normalizes the DDL for easier comparison.
     * 
     * @param ast List of SQL components (DDL statements)
     * @returns Generalized list of SQL components
     */
    public static generalize(ast: SqlComponent[]): SqlComponent[] {
        const result: SqlComponent[] = [];

        for (const component of ast) {
            if (component instanceof CreateTableQuery) {
                const { createTable, alterTables } = this.splitCreateTable(component);
                result.push(createTable);
                result.push(...alterTables);
            } else {
                result.push(component);
            }
        }

        return result;
    }

    private static splitCreateTable(query: CreateTableQuery): { createTable: CreateTableQuery, alterTables: AlterTableStatement[] } {
        const newColumns: TableColumnDefinition[] = [];
        const alterTables: AlterTableStatement[] = [];

        // Construct QualifiedName for the table
        const tableQualifiedName = new QualifiedName(query.namespaces || [], query.tableName.name);

        // Process columns
        for (const col of query.columns) {
            const newConstraints: ColumnConstraintDefinition[] = [];
            for (const constraint of col.constraints) {
                if (['primary-key', 'unique', 'references', 'check'].includes(constraint.kind)) {
                    // Move to Alter Table
                    const tableConstraint = this.columnToTableConstraint(col.name, constraint);
                    alterTables.push(new AlterTableStatement({
                        table: tableQualifiedName,
                        actions: [new AlterTableAddConstraint({ constraint: tableConstraint })]
                    }));
                } else {
                    // Keep (not-null, default, etc.)
                    newConstraints.push(constraint);
                }
            }
            newColumns.push(new TableColumnDefinition({
                name: col.name,
                dataType: col.dataType,
                constraints: newConstraints
            }));
        }

        // Process table constraints
        if (query.tableConstraints) {
            for (const constraint of query.tableConstraints) {
                alterTables.push(new AlterTableStatement({
                    table: tableQualifiedName,
                    actions: [new AlterTableAddConstraint({ constraint })]
                }));
            }
        }

        const newCreateTable = new CreateTableQuery({
            tableName: query.tableName.name,
            namespaces: query.namespaces,
            columns: newColumns,
            ifNotExists: query.ifNotExists,
            isTemporary: query.isTemporary,
            tableOptions: query.tableOptions,
            asSelectQuery: query.asSelectQuery,
            withDataOption: query.withDataOption,
            // tableConstraints is empty
            tableConstraints: []
        });

        return { createTable: newCreateTable, alterTables };
    }

    private static columnToTableConstraint(columnName: IdentifierString, constraint: ColumnConstraintDefinition): TableConstraintDefinition {
        const baseParams = {
            constraintName: constraint.constraintName,
            deferrable: constraint.reference?.deferrable,
            initially: constraint.reference?.initially
        };

        switch (constraint.kind) {
            case 'primary-key':
                return new TableConstraintDefinition({
                    kind: 'primary-key',
                    columns: [columnName],
                    ...baseParams
                });
            case 'unique':
                return new TableConstraintDefinition({
                    kind: 'unique',
                    columns: [columnName],
                    ...baseParams
                });
            case 'references':
                return new TableConstraintDefinition({
                    kind: 'foreign-key',
                    columns: [columnName],
                    reference: constraint.reference,
                    ...baseParams
                });
            case 'check':
                return new TableConstraintDefinition({
                    kind: 'check',
                    checkExpression: constraint.checkExpression,
                    ...baseParams
                });
            default:
                throw new Error(`Unsupported constraint kind for generalization: ${constraint.kind}`);
        }
    }
}
