import { describe, it, expect } from 'vitest';
import { SqlTokenizer } from '../src/parsers/SqlTokenizer';
import { OrderByClauseParser } from '../src/parsers/OrderByClauseParser';
import { SelectQueryParser } from '../src/parsers/SelectQueryParser';
import { SqlFormatter } from '../src/transformers/SqlFormatter';

describe('Debug ORDER BY Tokenizer', () => {
    it('should show how ORDER BY tokens are processed', () => {
        const orderBySQL = `ORDER BY id ASC /* ID ascending */, name DESC /* Name descending */`;

        console.log('🔍 ORDER BY tokenizer analysis...');
        console.log('\n📄 SQL:', orderBySQL);

        const tokenizer = new SqlTokenizer(orderBySQL);
        const lexemes = tokenizer.readLexmes();

        console.log('\n📝 All tokens:');
        lexemes.forEach((token, index) => {
            console.log(`[${index}] "${token.value}" (type: ${token.type})`);
            if (token.comments && token.comments.length > 0) {
                console.log(`    comments: [${token.comments.map(c => `"${c}"`).join(', ')}]`);
            }
            if (token.positionedComments && token.positionedComments.length > 0) {
                console.log(`    positionedComments:`, token.positionedComments);
            }
        });

        expect(true).toBe(true);
    });

    it('should test ORDER BY parsing directly', () => {
        const orderBySQL = `ORDER BY id ASC /* ID ascending */, name DESC /* Name descending */`;

        console.log('\n🔍 Direct ORDER BY parsing...');

        try {
            const orderByClause = OrderByClauseParser.parse(orderBySQL);
            console.log('\n📋 Parsed ORDER BY structure:');
            console.log('orderByClause type:', orderByClause.constructor.name);
            console.log('order items count:', orderByClause.order?.length || 0);

            if (orderByClause.order) {
                orderByClause.order.forEach((item, index) => {
                    console.log(`\nItem[${index}]:`, {
                        type: item.constructor.name,
                        comments: (item as any).comments,
                        positionedComments: (item as any).positionedComments
                    });

                    // Check the underlying value
                    if ((item as any).value) {
                        console.log(`  value:`, {
                            type: (item as any).value.constructor.name,
                            comments: (item as any).value.comments,
                            positionedComments: (item as any).value.positionedComments
                        });
                    }
                });
            }
        } catch (error) {
            console.error('Parse error:', error.message);
        }

        expect(true).toBe(true);
    });

    it('should test full SELECT with ORDER BY', () => {
        const fullSQL = `SELECT id, name FROM users ORDER BY id ASC /* ID ascending */, name DESC /* Name descending */`;

        console.log('\n🔍 Full SELECT query with ORDER BY...');

        const query = SelectQueryParser.parse(fullSQL);
        const simpleQuery = query.toSimpleQuery();

        console.log('\n📋 ORDER BY clause in full query:');
        if (simpleQuery.orderByClause) {
            console.log('Found ORDER BY clause:', simpleQuery.orderByClause.constructor.name);
            if (simpleQuery.orderByClause.order) {
                simpleQuery.orderByClause.order.forEach((item, index) => {
                    console.log(`Item[${index}]:`, {
                        type: item.constructor.name,
                        comments: (item as any).comments || 'null',
                        positionedComments: (item as any).positionedComments || 'null'
                    });
                    if ((item as any).value) {
                        console.log(`  value comments:`, (item as any).value.comments || 'null');
                    }
                });
            }
        } else {
            console.log('No ORDER BY clause found!');
        }

        // Test formatting
        const formatter = new SqlFormatter({ exportComment: true });
        const result = formatter.format(query);

        console.log('\n📝 Formatted result:');
        console.log(result.formattedSql);

        expect(true).toBe(true);
    });
});