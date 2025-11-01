import { describe, it, expect } from 'vitest';
import { SelectQueryParser } from '../../src/parsers/SelectQueryParser';
import { MergeQueryParser } from '../../src/parsers/MergeQueryParser';
import { QueryBuilder } from '../../src/transformers/QueryBuilder';
import { SqlFormatter } from '../../src/transformers/SqlFormatter';
import { SimpleSelectQuery } from '../../src/models/SimpleSelectQuery';
import { MergeDeleteAction, MergeDoNothingAction, MergeInsertAction, MergeUpdateAction } from '../../src/models/MergeQuery';
import { ColumnReference, ValueList } from '../../src/models/ValueComponent';

describe('buildMergeQuery', () => {
    it('builds MERGE with default actions', () => {
        const select = SelectQueryParser.parse('SELECT id, name FROM incoming_users') as SimpleSelectQuery;

        const mergeQuery = QueryBuilder.buildMergeQuery(select, {
            target: 'users u',
            primaryKeys: 'id',
            sourceAlias: 'src'
        });

        expect(mergeQuery.target.getAliasName()).toBe('u');
        expect(mergeQuery.source.getAliasName()).toBe('src');

        const clauseTypes = mergeQuery.whenClauses.map(clause => clause.matchType);
        expect(clauseTypes).toEqual(['matched', 'not_matched', 'not_matched_by_source']);

        const matchedAction = mergeQuery.whenClauses[0].action as MergeUpdateAction;
        expect(matchedAction).toBeInstanceOf(MergeUpdateAction);
        expect(matchedAction.setClause.items).toHaveLength(1);
        const setValue = matchedAction.setClause.items[0].value as ColumnReference;
        expect(setValue.namespaces?.[0].name).toBe('src');
        expect(setValue.column.name).toBe('name');

        const insertAction = mergeQuery.whenClauses[1].action as MergeInsertAction;
        expect(insertAction).toBeInstanceOf(MergeInsertAction);
        expect(insertAction.columns?.map(col => col.name)).toEqual(['id', 'name']);
        const insertValues = insertAction.values as ValueList;
        expect(insertValues.values).toHaveLength(2);
        const insertValueNamespaces = insertValues.values.map(value => (value as ColumnReference).namespaces?.[0].name);
        expect(insertValueNamespaces).toEqual(['src', 'src']);

        const doNothingAction = mergeQuery.whenClauses[2].action;
        expect(doNothingAction).toBeInstanceOf(MergeDoNothingAction);
    });

    it('builds MERGE via SelectQuery method with custom actions', () => {
        const select = SelectQueryParser.parse('SELECT id, status FROM audit_events') as SimpleSelectQuery;

        const mergeQuery = select.toMergeQuery({
            target: 'events e',
            primaryKeys: 'id',
            matchedAction: 'delete',
            notMatchedAction: 'doNothing',
            notMatchedBySourceAction: 'delete',
            sourceAlias: 'src'
        });

        expect(mergeQuery.target.getAliasName()).toBe('e');
        expect(mergeQuery.source.getAliasName()).toBe('src');

        const clauseTypes = mergeQuery.whenClauses.map(clause => clause.matchType);
        expect(clauseTypes).toEqual(['matched', 'not_matched', 'not_matched_by_source']);

        expect(mergeQuery.whenClauses[0].action).toBeInstanceOf(MergeDeleteAction);
        expect(mergeQuery.whenClauses[1].action).toBeInstanceOf(MergeDoNothingAction);
        expect(mergeQuery.whenClauses[2].action).toBeInstanceOf(MergeDeleteAction);
    });

    it('respects explicit merge column order when subsets are provided', () => {
        const select = SelectQueryParser.parse('SELECT id, name FROM incoming_users') as SimpleSelectQuery;

        const mergeQuery = QueryBuilder.buildMergeQuery(select, {
            target: 'users u',
            primaryKeys: 'id',
            updateColumns: ['name'],
            insertColumns: ['name', 'id'],
            sourceAlias: 'src'
        });

        const updateAction = mergeQuery.whenClauses.find(clause => clause.matchType === 'matched')?.action as MergeUpdateAction;
        expect(updateAction.setClause.items.map(item => item.column.name)).toEqual(['name']);

        const insertAction = mergeQuery.whenClauses.find(clause => clause.matchType === 'not_matched')?.action as MergeInsertAction;
        expect(insertAction.columns?.map(col => col.name)).toEqual(['name', 'id']);
    });

    it('removes extra select columns when explicit merge lists are provided', () => {
        const select = SelectQueryParser.parse('SELECT id, name, age, extra FROM incoming_users') as SimpleSelectQuery;

        const mergeQuery = QueryBuilder.buildMergeQuery(select, {
            target: 'users',
            primaryKeys: 'id',
            updateColumns: ['name', 'age'],
            insertColumns: ['id', 'name'],
            sourceAlias: 'src'
        });

        const updateAction = mergeQuery.whenClauses.find(clause => clause.matchType === 'matched')?.action as MergeUpdateAction;
        expect(updateAction.setClause.items.map(item => item.column.name)).toEqual(['name', 'age']);

        const insertAction = mergeQuery.whenClauses.find(clause => clause.matchType === 'not_matched')?.action as MergeInsertAction;
        expect(insertAction.columns?.map(col => col.name)).toEqual(['id', 'name']);
    });

    it('throws when merge update columns do not match select output', () => {
        const select = SelectQueryParser.parse('SELECT id FROM incoming_users') as SimpleSelectQuery;

        expect(() => QueryBuilder.buildMergeQuery(select, {
            target: 'users',
            primaryKeys: 'id',
            updateColumns: ['name'],
            sourceAlias: 'src'
        })).toThrowError('Provided update columns were not found in selectQuery output or are primary keys: [name].');
    });

    it('throws when merge insert columns do not match select output', () => {
        const select = SelectQueryParser.parse('SELECT id FROM incoming_users') as SimpleSelectQuery;

        expect(() => QueryBuilder.buildMergeQuery(select, {
            target: 'users',
            primaryKeys: 'id',
            matchedAction: 'doNothing',
            notMatchedAction: 'insert',
            insertColumns: ['name'],
            sourceAlias: 'src'
        })).toThrowError('Provided insert columns were not found in selectQuery output: [name].');
    });

    it('formats MERGE queries via SqlFormatter', () => {
        const select = SelectQueryParser.parse('SELECT id, name FROM incoming_users') as SimpleSelectQuery;

        const mergeQuery = QueryBuilder.buildMergeQuery(select, {
            target: 'users u',
            primaryKeys: 'id',
            updateColumns: ['name'],
            insertColumns: ['id', 'name'],
            sourceAlias: 'src'
        });

        const sql = new SqlFormatter().format(mergeQuery).formattedSql;
        expect(sql).toBe('merge into "users" as "u" using (select "id", "name" from "incoming_users") as "src" on "u"."id" = "src"."id" when matched then update set "name" = "src"."name" when not matched then insert("id", "name") values("src"."id", "src"."name") when not matched by source then do nothing');
    });

    it('formats comments before merge insert values clauses', () => {
        const mergeSql = [
            '-- c1',
            'merge into users as target --c2',
            'using temp_users as source --c3',
            'on target.user_id = source.user_id --c4',
            'when matched then',
            '    --c5',
            '    update set',
            '        --c6',
            '        username = source.username',
            '        --c7',
            '        ,',
            '        --c8',
            '        email = source.email',
            '        --c9',
            '        ,',
            '        --c10',
            '        updated_at = now()',
            '        --c11',
            'when not matched then',
            '    -- c12',
            '    insert (user_id, username, email, created_at) --c13',
            '    values (source.user_id, source.username, source.email, now())',
            '    --c14'
        ].join('\n');

        const mergeQuery = MergeQueryParser.parse(mergeSql);
        const formatter = new SqlFormatter({
            exportComment: true,
            keywordCase: 'lower',
            newline: '\n'
        });

        const formatted = formatter.format(mergeQuery).formattedSql;

        expect(formatted).toMatch(/\/\* c13 \*\/\s*\n\s*values/);
        expect(formatted).toContain('now() /* c14 */');
    });
});
