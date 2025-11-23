import { describe, it, expect } from 'vitest';
import { DDLGeneralizer } from '../../src/transformers/DDLGeneralizer';
import { SqlParser } from '../../src/parsers/SqlParser';
import { SqlFormatter } from '../../src/transformers/SqlFormatter';
import { CreateTableQuery } from '../../src/models/CreateTableQuery';
import { AlterTableStatement } from '../../src/models/DDLStatements';

describe('DDLGeneralizer', () => {
    const formatter = new SqlFormatter({ keywordCase: 'upper' });

    it('should move inline constraints to ALTER TABLE', () => {
        const sql = `CREATE TABLE users (
            id INTEGER PRIMARY KEY,
            name TEXT UNIQUE,
            email TEXT NOT NULL
        )`;
        const ast = [SqlParser.parse(sql)];
        const generalized = DDLGeneralizer.generalize(ast);

        expect(generalized.length).toBe(3); // CreateTable + Alter(PK) + Alter(Unique)

        const createTable = generalized[0] as CreateTableQuery;
        expect(createTable.columns.length).toBe(3);
        // Check constraints on columns (only NOT NULL should remain)
        expect(createTable.columns[0].constraints.length).toBe(0);
        expect(createTable.columns[1].constraints.length).toBe(0);
        expect(createTable.columns[2].constraints.length).toBe(1); // NOT NULL

        const alter1 = generalized[1] as AlterTableStatement;
        expect(formatter.format(alter1).formattedSql).toContain('ADD PRIMARY KEY("id")');

        const alter2 = generalized[2] as AlterTableStatement;
        expect(formatter.format(alter2).formattedSql).toContain('ADD UNIQUE("name")');
    });

    it('should handle named constraints', () => {
        const sql = `CREATE TABLE users (
            id INTEGER CONSTRAINT pk_users PRIMARY KEY
        )`;
        const ast = [SqlParser.parse(sql)];
        const generalized = DDLGeneralizer.generalize(ast);

        const alter = generalized[1] as AlterTableStatement;
        expect(formatter.format(alter).formattedSql).toContain('ADD CONSTRAINT "pk_users" PRIMARY KEY("id")');
    });
});
