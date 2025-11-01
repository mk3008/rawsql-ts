import { describe, it, expect } from 'vitest';
import { MergeQueryParser } from '../../src/parsers/MergeQueryParser';
import { SqlFormatter } from '../../src/transformers/SqlFormatter';

describe('SqlFormatter MERGE formatting', () => {
    it('formats MERGE statements with structured clause breaks', () => {
        const unformatted = [
            'merge into destinations as d using (',
            '    select',
            '        a.id',
            '        , a.sub_id',
            '        , a.v1',
            '        , a.v2',
            '    from',
            '        table as a',
            ') as s on d.id = s.id',
            'and d.sub_id = s.sub_id when matched then update set',
            '    v1 = s.v1',
            '    , v2 = s.v2',
            'when not matched',
            'and s.id is null',
            'and s.sub_id is null then insert (v1',
            ', v2)',
            'values (s.v1, s.v2) when not matched then insert (id',
            ', sub_id',
            ', v1',
            ', v2)',
            'values (s.id, s.sub_id, s.v1, s.v2)',
        ].join('\n');

        const formatter = new SqlFormatter({
            indentSize: 4,
            indentChar: ' ',
            newline: '\n',
            keywordCase: 'upper',
            commaBreak: 'after',
            valuesCommaBreak: 'after',
            andBreak: 'none',
            identifierEscape: 'none',
            insertColumnsOneLine: true,
            whenOneLine: true,
        });

        const mergeQuery = MergeQueryParser.parse(unformatted);
        const { formattedSql } = formatter.format(mergeQuery);

        const expected = [
            'MERGE INTO destinations AS d',
            'USING (',
            '    SELECT',
            '        a.id,',
            '        a.sub_id,',
            '        a.v1,',
            '        a.v2',
            '    FROM',
            '        table AS a',
            ') AS s ON d.id = s.id AND d.sub_id = s.sub_id',
            'WHEN MATCHED THEN',
            '    UPDATE SET',
            '        v1 = s.v1',
            '        , v2 = s.v2',
            'WHEN NOT MATCHED AND s.id is null AND s.sub_id is null THEN',
            '    INSERT(v1, v2)',
            '    VALUES(s.v1, s.v2)',
            'WHEN NOT MATCHED THEN',
            '    INSERT(id, sub_id, v1, v2)',
            '    VALUES(s.id, s.sub_id, s.v1, s.v2)',
        ].join('\n');

        expect(formattedSql).toBe(expected);
    });

    it('keeps MERGE ON predicates on a single line when joinOneLine is enabled', () => {
        const sql = [
            'merge into dst using src on dst.id = src.id and dst.sub_id = src.sub_id',
            'when matched then update set val = src.val',
        ].join('\n');

        const formatter = new SqlFormatter({
            keywordCase: 'upper',
            newline: '\n',
            andBreak: 'before',
            joinOneLine: true,
            identifierEscape: 'none',
            whenOneLine: true,
        });

        const formatted = formatter.format(MergeQueryParser.parse(sql)).formattedSql;
        expect(formatted).toContain('ON dst.id = src.id AND dst.sub_id = src.sub_id');
    });

    it('keeps MERGE WHEN predicates on a single line even when andBreak is before', () => {
        const unformatted = [
            'merge into destinations as d using (',
            '    select',
            '        a.id',
            '        , a.sub_id',
            '        , a.v1',
            '        , a.v2',
            '    from',
            '        table as a',
            ') as s on d.id = s.id',
            'and d.sub_id = s.sub_id when matched then update set',
            '    v1 = s.v1',
            '    , v2 = s.v2',
            'when not matched',
            'and s.id is null',
            'and s.sub_id is null then insert (v1',
            ', v2)',
            'values (s.v1, s.v2) when not matched then insert (id',
            ', sub_id',
            ', v1',
            ', v2)',
            'values (s.id, s.sub_id, s.v1, s.v2)',
        ].join('\n');

        const formatter = new SqlFormatter({
            indentSize: 4,
            indentChar: ' ',
            newline: '\n',
            keywordCase: 'upper',
            commaBreak: 'after',
            valuesCommaBreak: 'after',
            andBreak: 'before',
            identifierEscape: 'none',
            insertColumnsOneLine: true,
            whenOneLine: true,
        });

        const mergeQuery = MergeQueryParser.parse(unformatted);
        const { formattedSql } = formatter.format(mergeQuery);

        const expected = [
            'MERGE INTO destinations AS d',
            'USING (',
            '    SELECT',
            '        a.id,',
            '        a.sub_id,',
            '        a.v1,',
            '        a.v2',
            '    FROM',
            '        table AS a',
            ') AS s ON d.id = s.id',
            'AND d.sub_id = s.sub_id',
            'WHEN MATCHED THEN',
            '    UPDATE SET',
            '        v1 = s.v1',
            '        , v2 = s.v2',
            'WHEN NOT MATCHED AND s.id is null AND s.sub_id is null THEN',
            '    INSERT(v1, v2)',
            '    VALUES(s.v1, s.v2)',
            'WHEN NOT MATCHED THEN',
            '    INSERT(id, sub_id, v1, v2)',
            '    VALUES(s.id, s.sub_id, s.v1, s.v2)',
        ].join('\n');

        expect(formattedSql).toBe(expected);
    });

    it('preserves smart comments alignment within MERGE actions', () => {
        const unformatted = [
            '-- c1',
            'merge into users as target --c2',
            'using temp_users as source --c3',
            'on target.user_id = source.user_id --c4',
            'when matched then',
            '\t--c5',
            '    update',
            '    set',
            '    \t--c6',
            '        username = source.username',
            '        --c7',
            '        ,',
            '        --c8',
            '        email = source.email',
            '        --c9',
            '        ,',
            '        --c10',
            '        updated_at = now() ',
            '        --c11',
            'when not matched then',
            '    -- c12',
            '    insert (user_id, username, email, created_at) --c13',
            '    values (source.user_id, source.username, source.email, now())',
            '    --c14',
        ].join('\n');

        const formatter = new SqlFormatter({
            keywordCase: 'upper',
            newline: '\n',
            indentSize: 4,
            indentChar: ' ',
            identifierEscape: 'none',
            andBreak: 'none',
            commentStyle: 'smart',
            exportComment: true,
        });

        const mergeQuery = MergeQueryParser.parse(unformatted);
        const { formattedSql } = formatter.format(mergeQuery);

        const expected = [
            '-- c1',
            'MERGE INTO users AS target -- c2',
            'USING temp_users AS source -- c3',
            'ON target.user_id = source.user_id -- c4',
            'WHEN MATCHED THEN',
            '    -- c5',
            '    UPDATE SET',
            '        -- c6',
            '        username = source.username -- c7',
            '        , -- c8',
            '        email = source.email -- c9',
            '        , -- c10',
            '        updated_at = now() -- c11',
            'WHEN NOT MATCHED THEN',
            '    -- c12',
            '    INSERT(',
            '    user_id, username, email, created_at',
            ')',
            '    -- c13',
            '    VALUES(',
            '    source.user_id, source.username, source.email, now() -- c14',
            ')',
        ].join('\n');

        expect(formattedSql).toBe(expected);
    });

});
