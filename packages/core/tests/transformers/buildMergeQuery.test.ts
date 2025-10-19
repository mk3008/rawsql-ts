import { describe, it, expect } from 'vitest';
import { SelectQueryParser } from '../../src/parsers/SelectQueryParser';
import { QueryBuilder } from '../../src/transformers/QueryBuilder';
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

    it('drops missing merge columns when select output omits them', () => {
        const select = SelectQueryParser.parse('SELECT id, name FROM incoming_users') as SimpleSelectQuery;

        const mergeQuery = QueryBuilder.buildMergeQuery(select, {
            target: 'users u',
            primaryKeys: 'id',
            updateColumns: ['name', 'age'],
            insertColumns: ['id', 'name', 'age'],
            sourceAlias: 'src'
        });

        const updateAction = mergeQuery.whenClauses.find(clause => clause.matchType === 'matched')?.action as MergeUpdateAction;
        expect(updateAction.setClause.items.map(item => item.column.name)).toEqual(['name']);

        const insertAction = mergeQuery.whenClauses.find(clause => clause.matchType === 'not_matched')?.action as MergeInsertAction;
        expect(insertAction.columns?.map(col => col.name)).toEqual(['id', 'name']);
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
        })).toThrowError('No columns available for MERGE update action. Provide updateColumns or ensure the select list includes non-key columns.');
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
        })).toThrowError('Unable to infer MERGE insert columns. Provide insertColumns explicitly.');
    });
});
