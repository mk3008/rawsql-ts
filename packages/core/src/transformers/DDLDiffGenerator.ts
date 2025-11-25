import { SqlParser } from "../parsers/SqlParser";
import { SqlFormatter } from "./SqlFormatter";
import { DDLGeneralizer } from "./DDLGeneralizer";
import { MultiQuerySplitter } from "../utils/MultiQuerySplitter";
import { CreateTableQuery, TableColumnDefinition, TableConstraintDefinition } from "../models/CreateTableQuery";
import { AlterTableStatement, AlterTableAddConstraint, AlterTableAddColumn, AlterTableDropColumn, AlterTableDropConstraint, DropTableStatement, CreateIndexStatement, DropIndexStatement } from "../models/DDLStatements";
import { SqlComponent } from "../models/SqlComponent";
import { QualifiedName, RawString, IdentifierString } from "../models/ValueComponent";

import { SqlFormatterOptions } from "./SqlFormatter";

export interface DDLDiffOptions {
    dropTables?: boolean;
    dropColumns?: boolean;
    dropConstraints?: boolean;
    dropIndexes?: boolean;
    checkConstraintNames?: boolean;
    formatOptions?: SqlFormatterOptions;
}

interface ColumnModel {
    name: string;
    definition: TableColumnDefinition; // Keep AST for reproduction
}

interface ConstraintModel {
    name?: string;
    kind: string;
    definition: TableConstraintDefinition; // Keep AST for reproduction
    formatted: string; // For comparison
}

interface IndexModel {
    name: string;
    definition: CreateIndexStatement;
    formatted: string;
}

interface TableModel {
    name: string;
    qualifiedName: QualifiedName;
    columns: Map<string, ColumnModel>;
    constraints: ConstraintModel[];
    indexes: IndexModel[];
}

export class DDLDiffGenerator {
    public static generateDiff(currentSql: string, expectedSql: string, options: DDLDiffOptions = {}): string[] {
        const currentAst = this.parseAndGeneralize(currentSql);
        const expectedAst = this.parseAndGeneralize(expectedSql);

        const currentSchema = this.buildSchema(currentAst);
        const expectedSchema = this.buildSchema(expectedAst);

        const diffAsts: SqlComponent[] = [];

        // Compare Tables
        for (const [tableName, expectedTable] of expectedSchema.tables) {
            const currentTable = currentSchema.tables.get(tableName);

            if (!currentTable) {
                // Table missing in current -> Create it
                // We reconstruct the CreateTableQuery from columns
                const columns = Array.from(expectedTable.columns.values()).map(c => c.definition);
                const tableNameStr = expectedTable.qualifiedName.name instanceof RawString
                    ? expectedTable.qualifiedName.name.value
                    : expectedTable.qualifiedName.name.name;
                const namespaces = expectedTable.qualifiedName.namespaces
                    ? expectedTable.qualifiedName.namespaces.map(ns => ns.name)
                    : null;

                const createTable = new CreateTableQuery({
                    tableName: tableNameStr,
                    namespaces: namespaces,
                    columns: columns
                });
                diffAsts.push(createTable);

                // And add constraints
                for (const constraint of expectedTable.constraints) {
                    diffAsts.push(new AlterTableStatement({
                        table: expectedTable.qualifiedName,
                        actions: [new AlterTableAddConstraint({ constraint: constraint.definition })]
                    }));
                }

                // And add indexes
                for (const index of expectedTable.indexes) {
                    diffAsts.push(index.definition);
                }
            } else {
                // Table exists -> Compare columns and constraints
                this.compareColumns(currentTable, expectedTable, diffAsts, options);
                this.compareConstraints(currentTable, expectedTable, diffAsts, options);
                this.compareIndexes(currentTable, expectedTable, diffAsts, options);
            }
        }

        // Drop Tables (if enabled)
        if (options.dropTables) {
            for (const [tableName, currentTable] of currentSchema.tables) {
                if (!expectedSchema.tables.has(tableName)) {
                    // Table exists in current but not in expected -> Drop it
                    // We need a DropTableStatement. For now, we can manually construct the SQL or add DropTableStatement model.
                    // Since we return string[], we can just push a raw SQL string if we don't have the AST model yet,
                    // OR better, let's use a simple object that formats to DROP TABLE.
                    // But wait, the return type is string[] derived from ASTs.
                    // Let's assume we can use a raw SQL component or similar.
                    // Actually, let's just use a simple custom AST node or formatted string injection if possible.
                    // Looking at imports, we don't have DropTableStatement.
                    // Let's add a temporary workaround or just return the string directly?
                    // The method returns string[] by mapping diffAsts.
                    // We should add a DropTableStatement class or similar.
                    // For now, let's just push a dummy component that formats to DROP TABLE.

                    // Actually, let's check if we can import DropTableStatement.
                    // It seems it's not imported. Let's check DDLStatements.ts.

                    // If we can't easily add the AST, we might need to hack it or add the class.
                    // Let's try to add a simple DropTableStatement to DDLStatements.ts first if needed.
                    // But for now, let's assume we can just append the string at the end?
                    // No, the return is `diffAsts.map(...)`.

                    // Let's create a simple ad-hoc object that satisfies SqlComponent and formats correctly.
                    diffAsts.push(new DropTableStatement({
                        tables: [currentTable.qualifiedName],
                        ifExists: false
                    }));
                }
            }
        }

        // Format output
        const formatter = new SqlFormatter(options.formatOptions || { keywordCase: 'upper' });
        return diffAsts.map(ast => formatter.format(ast).formattedSql + ';');
    }

    private static parseAndGeneralize(sql: string): SqlComponent[] {
        const split = MultiQuerySplitter.split(sql);
        const asts: SqlComponent[] = [];
        for (const q of split.queries) {
            if (q.isEmpty) continue;
            try {
                const ast = SqlParser.parse(q.sql);
                asts.push(ast);
            } catch (e) {
                // Ignore parse errors? Or throw?
                // For diffing, we probably want to know if input is invalid.
                console.warn("Failed to parse SQL for diff:", q.sql, e);
            }
        }
        return DDLGeneralizer.generalize(asts);
    }

    private static buildSchema(asts: SqlComponent[]): { tables: Map<string, TableModel> } {
        const tables = new Map<string, TableModel>();
        const formatter = new SqlFormatter({ keywordCase: 'none' });

        for (const ast of asts) {
            if (ast instanceof CreateTableQuery) {
                const qName = new QualifiedName(ast.namespaces || [], ast.tableName);
                const key = this.getQualifiedNameKey(qName);

                const tableModel: TableModel = {
                    name: key,
                    qualifiedName: qName,
                    columns: new Map(),
                    constraints: [],
                    indexes: []
                };

                for (const col of ast.columns) {
                    tableModel.columns.set(col.name.name, {
                        name: col.name.name,
                        definition: col
                    });
                }
                // Generalized CreateTable shouldn't have tableConstraints, but if it did, we'd handle them.

                tables.set(key, tableModel);
            } else if (ast instanceof AlterTableStatement) {
                const key = this.getQualifiedNameKey(ast.table);
                const tableModel = tables.get(key);
                if (tableModel) {
                    for (const action of ast.actions) {
                        if (action instanceof AlterTableAddConstraint) {
                            const formatted = formatter.format(action.constraint).formattedSql;
                            tableModel.constraints.push({
                                name: action.constraint.constraintName?.name,
                                kind: action.constraint.kind,
                                definition: action.constraint,
                                formatted: formatted
                            });
                        } else if (action instanceof AlterTableAddColumn) {
                            tableModel.columns.set(action.column.name.name, {
                                name: action.column.name.name,
                                definition: action.column
                            });
                        }
                    }
                }
            } else if (ast instanceof CreateIndexStatement) {
                const key = this.getQualifiedNameKey(ast.tableName);
                const tableModel = tables.get(key);
                if (tableModel) {
                    const formatted = formatter.format(ast).formattedSql;
                    tableModel.indexes.push({
                        name: ast.indexName.toString(),
                        definition: ast,
                        formatted: formatted
                    });
                }
            }
        }
        return { tables };
    }

    private static compareColumns(current: TableModel, expected: TableModel, diffs: SqlComponent[], options: DDLDiffOptions) {
        // Add missing columns
        for (const [name, col] of expected.columns) {
            if (!current.columns.has(name)) {
                diffs.push(new AlterTableStatement({
                    table: expected.qualifiedName,
                    actions: [new AlterTableAddColumn({ column: col.definition })]
                }));
            }
        }

        // Drop extra columns
        if (options.dropColumns) {
            for (const [name, col] of current.columns) {
                if (!expected.columns.has(name)) {
                    diffs.push(new AlterTableStatement({
                        table: expected.qualifiedName,
                        actions: [new AlterTableDropColumn({ columnName: col.definition.name })]
                    }));
                }
            }
        }
    }

    private static compareConstraints(current: TableModel, expected: TableModel, diffs: SqlComponent[], options: DDLDiffOptions) {
        // We need to match constraints.
        // If checkConstraintNames is true, match by name.
        // Else, match by formatted definition (ignoring name in formatting if possible, but SqlFormatter prints name).
        // To compare by definition ignoring name, we might need to strip name from definition before formatting.

        const formatter = new SqlFormatter({ keywordCase: 'none' });

        const getConstraintSignature = (c: ConstraintModel) => {
            if (options.checkConstraintNames) {
                return c.name || c.formatted; // Fallback if no name?
            }
            // Remove name from definition for comparison
            // "CONSTRAINT name PRIMARY KEY ..." vs "PRIMARY KEY ..."
            // If we format it, it might include CONSTRAINT name.
            // We can regex remove it?
            return c.formatted.replace(/CONSTRAINT\s+\S+\s+/, '');
        };

        const currentSignatures = new Set(current.constraints.map(getConstraintSignature));

        // Add missing constraints
        for (const expectedC of expected.constraints) {
            const sig = getConstraintSignature(expectedC);
            if (!currentSignatures.has(sig)) {
                diffs.push(new AlterTableStatement({
                    table: expected.qualifiedName,
                    actions: [new AlterTableAddConstraint({ constraint: expectedC.definition })]
                }));
            }
        }

        // Drop extra constraints
        if (options.dropConstraints) {
            const expectedSignatures = new Set(expected.constraints.map(getConstraintSignature));
            for (const currentC of current.constraints) {
                const sig = getConstraintSignature(currentC);
                if (!expectedSignatures.has(sig)) {
                    // To drop, we need a name. If no name, we can't drop easily (DBs usually auto-name).
                    if (currentC.name) {
                        diffs.push(new AlterTableStatement({
                            table: expected.qualifiedName,
                            actions: [new AlterTableDropConstraint({ constraintName: new IdentifierString(currentC.name) })]
                        }));
                    } else {
                        console.warn("Cannot drop unnamed constraint:", currentC.formatted);
                    }
                }
            }
        }
    }

    private static compareIndexes(current: TableModel, expected: TableModel, diffs: SqlComponent[], options: DDLDiffOptions) {
        const getIndexSignature = (idx: IndexModel) => {
            if (options.checkConstraintNames) {
                // When Check Names is enabled, index name matters
                return idx.name;
            }
            // When Check Names is disabled, compare by structural properties from AST
            // Compare: table name, columns (expressions), unique flag, using method, where clause
            const def = idx.definition;
            const parts: string[] = [];

            // Table name
            parts.push(def.tableName.toString());

            // Unique flag
            if (def.unique) {
                parts.push('UNIQUE');
            }

            // Using method (e.g., BTREE, HASH)
            if (def.usingMethod) {
                parts.push(`USING:${def.usingMethod.toString()}`);
            }

            // Columns (expressions and sort orders)
            const columnSigs = def.columns.map(col => {
                const expr = col.expression.toString();
                const sort = col.sortOrder || '';
                const nulls = col.nullsOrder || '';
                return `${expr}${sort}${nulls}`;
            });
            parts.push(`COLS:${columnSigs.join(',')}`);

            // Include columns
            if (def.include && def.include.length > 0) {
                parts.push(`INCLUDE:${def.include.map(i => i.toString()).join(',')}`);
            }

            // Where clause
            if (def.where) {
                parts.push(`WHERE:${def.where.toString()}`);
            }

            return parts.join('|');
        };

        const currentSignatures = new Set(current.indexes.map(getIndexSignature));

        // Add missing indexes
        for (const expectedIdx of expected.indexes) {
            const sig = getIndexSignature(expectedIdx);
            if (!currentSignatures.has(sig)) {
                diffs.push(expectedIdx.definition);
            }
        }

        // Drop extra indexes
        // When checkConstraintNames is enabled, we should drop indexes with different names
        // When dropIndexes is enabled, we should drop all extra indexes
        if (options.checkConstraintNames || options.dropIndexes) {
            const expectedSignatures = new Set(expected.indexes.map(getIndexSignature));
            for (const currentIdx of current.indexes) {
                const sig = getIndexSignature(currentIdx);
                if (!expectedSignatures.has(sig)) {
                    diffs.push(new DropIndexStatement({
                        indexNames: [currentIdx.definition.indexName],
                        ifExists: false
                    }));
                }
            }
        }
    }

    private static getQualifiedNameKey(qName: QualifiedName): string {
        return qName.toString();
    }
}
