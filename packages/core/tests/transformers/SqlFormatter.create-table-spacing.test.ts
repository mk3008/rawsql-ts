import { describe, it, expect } from 'vitest';
import { CreateTableParser } from '../../src/parsers/CreateTableParser';
import { SqlFormatter } from '../../src/transformers/SqlFormatter';

describe('SqlFormatter CREATE TABLE spacing', () => {
    it('omits spaces before parentheses for table name and constraint keywords', () => {
        const sql = [
            'CREATE TABLE public.child_table (',
            '    child_id serial4 NOT NULL',
            '    , child_name VARCHAR(100) NOT NULL',
            '    , CONSTRAINT child_table_pkey PRIMARY KEY (child_id)',
            '    , CONSTRAINT child_table_name_unique UNIQUE (child_name)',
            '    , CONSTRAINT child_table_value_check CHECK (child_id > 0)',
            ')',
        ].join('\n');

        const ast = CreateTableParser.parse(sql);
        const formatter = new SqlFormatter({
            indentChar: ' ',
            indentSize: 4,
            newline: '\n',
            keywordCase: 'lower',
            commaBreak: 'before',
            identifierEscape: 'none',
        });

        const { formattedSql } = formatter.format(ast);

        const expected = [
            'create table public.child_table(',
            '    child_id serial4 not null',
            '    , child_name varchar(100) not null',
            '    , constraint child_table_pkey primary key(child_id)',
            '    , constraint child_table_name_unique unique(child_name)',
            '    , constraint child_table_value_check check(child_id > 0)',
            ')',
        ].join('\n');

        expect(formattedSql).toBe(expected);
    });

    it('omits spaces before parentheses for foreign key references', () => {
        const sql = [
            'CREATE TABLE public.order_item (',
            '    item_id serial4 NOT NULL',
            '    , order_id int4 NOT NULL',
            '    , CONSTRAINT order_item_fk FOREIGN KEY (order_id) REFERENCES public.order (order_id)',
            ')',
        ].join('\n');

        const ast = CreateTableParser.parse(sql);
        const formatter = new SqlFormatter({
            indentChar: ' ',
            indentSize: 4,
            newline: '\n',
            keywordCase: 'lower',
            commaBreak: 'before',
            identifierEscape: 'none',
        });

        const { formattedSql } = formatter.format(ast);

        const expected = [
            'create table public.order_item(',
            '    item_id serial4 not null',
            '    , order_id int4 not null',
            '    , constraint order_item_fk foreign key(order_id) references public.order(order_id)',
            ')',
        ].join('\n');

        expect(formattedSql).toBe(expected);
    });

    it('handles MySQL-style constraint names without extra spaces before parentheses', () => {
        const sql = [
            'CREATE TABLE t (',
            '    id int NOT NULL',
            '    , UNIQUE KEY uk (id)',
            '    , FOREIGN KEY fk (id) REFERENCES parent (pid)',
            ')',
        ].join('\n');

        const ast = CreateTableParser.parse(sql);
        const formatter = new SqlFormatter({
            indentChar: ' ',
            indentSize: 4,
            newline: '\n',
            keywordCase: 'lower',
            commaBreak: 'before',
            identifierEscape: 'none',
            constraintStyle: 'mysql',
        });

        const { formattedSql } = formatter.format(ast);

        const expected = [
            'create table t(',
            '    id int not null',
            '    , unique key uk(id)',
            '    , foreign key fk(id) references parent(pid)',
            ')',
        ].join('\n');

        expect(formattedSql).toBe(expected);
    });

    it('keeps SELECT aligned after AS in CREATE TABLE AS SELECT', () => {
        const sql = [
            'create table active_users as',
            'select',
            '    1'
        ].join('\n');

        const ast = CreateTableParser.parse(sql);
        const formatter = new SqlFormatter({
            indentChar: ' ',
            indentSize: 4,
            newline: '\n',
            keywordCase: 'lower',
            commaBreak: 'before',
            identifierEscape: 'none',
        });

        const { formattedSql } = formatter.format(ast);

        const expected = [
            'create table active_users as',
            'select',
            '    1'
        ].join('\n');

        expect(formattedSql).toBe(expected);
    });
});
