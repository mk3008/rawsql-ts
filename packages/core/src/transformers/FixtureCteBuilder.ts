import { CommonTable, SourceAliasExpression } from '../models/Clause';
import { SelectQueryParser } from '../parsers/SelectQueryParser';

/** Describes a single column in a fixture used for query rewriting. */
export interface FixtureColumnDefinition {
    name: string;
    typeName?: string;
    defaultValue?: string;
}

/** Defines the data required to represent a fixture table as a CTE. */
export interface FixtureTableDefinition {
    tableName: string;
    columns: FixtureColumnDefinition[];
    rows: (string | number | bigint | Buffer | null)[][];
}

export class FixtureCteBuilder {
    /** Builds CommonTable representations for the provided fixtures. */
    public static buildFixtures(fixtures: FixtureTableDefinition[]): CommonTable[] {
        return fixtures.map((fixture) => this.buildFixture(fixture));
    }

    private static buildFixture(fixture: FixtureTableDefinition): CommonTable {
        const selectSql = this.buildSelectStatement(fixture);
        const query = SelectQueryParser.parse(selectSql);
        // Wrap the parsed statement into a CommonTable for later WITH clause injection.
        return new CommonTable(query, fixture.tableName, null);
    }

    private static buildSelectStatement(fixture: FixtureTableDefinition): string {
        const columnCount = fixture.columns.length;
        // Always produce at least one row even when the fixture carries zero entries.
        const rows = fixture.rows.length > 0 ? fixture.rows : [new Array(columnCount).fill(null)];
        const selects = rows.map((row) => this.buildSelectRow(fixture.columns, row));
        const statements = selects.join('\nUNION ALL\n');
        if (fixture.rows.length === 0) {
            return `${statements} WHERE 1 = 0`;
        }
        return statements;
    }

    private static buildSelectRow(columns: FixtureColumnDefinition[], row: (string | number | bigint | Buffer | null)[]): string {
        // Build select expressions that respect optional type annotations.
        const expressions = columns.map((column, index) => {
            const literal = this.formatLiteral(index < row.length ? row[index] : null);
            const identifier = this.quoteIdentifier(column.name);
            if (column.typeName) {
                return `CAST(${literal} AS ${column.typeName}) AS ${identifier}`;
            }
            return `${literal} AS ${identifier}`;
        });
        return `SELECT ${expressions.join(', ')}`;
    }

    private static formatLiteral(value: string | number | bigint | Buffer | null | undefined): string {
        if (value === null || value === undefined) {
            return 'NULL';
        }
        if (typeof value === 'number') {
            return Number.isFinite(value) ? value.toString() : 'NULL';
        }
        if (typeof value === 'bigint') {
            return value.toString();
        }
        if (typeof Buffer !== 'undefined' && value instanceof Buffer) {
            return `X'${value.toString('hex')}'`;
        }
        if (typeof value === 'string') {
            const escaped = value.replace(/'/g, "''");
            return `'${escaped}'`;
        }
        return `'${String(value)}'`;
    }

    private static quoteIdentifier(value: string): string {
        const escaped = value.replace(/"/g, '""');
        return `"${escaped}"`;
    }
}
