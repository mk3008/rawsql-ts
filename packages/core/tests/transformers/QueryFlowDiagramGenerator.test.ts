import { describe, it, beforeEach, expect } from 'vitest';
import { QueryFlowDiagramGenerator } from '../../src/transformers/QueryFlowDiagramGenerator';

describe('QueryFlowDiagramGenerator - Full Mermaid Output Tests', () => {
    let generator: QueryFlowDiagramGenerator;

    beforeEach(() => {
        generator = new QueryFlowDiagramGenerator();
    });

    describe('Basic SELECT Queries', () => {
        it('should generate complete Mermaid for simple SELECT from table', () => {
            const sql = 'SELECT id, name FROM users';
            
            const result = generator.generateMermaidFlow(sql);
            
            expect(result).toBe(`flowchart TD
    table_users[(users)]
    main_select{{SELECT}}
    main_output(Final Result)

    table_users --> main_select
    main_select --> main_output
`);
        });

        it('should generate complete Mermaid for SELECT without FROM clause', () => {
            const sql = "SELECT 1 as num, 'test' as str";
            
            const result = generator.generateMermaidFlow(sql);
            
            expect(result).toBe(`flowchart TD
    main_output(Final Result)
`);
        });

        it('should generate complete Mermaid for SELECT with WHERE', () => {
            const sql = 'SELECT id, name FROM users WHERE active = true';
            
            const result = generator.generateMermaidFlow(sql);
            
            expect(result).toBe(`flowchart TD
    table_users[(users)]
    main_where{{WHERE}}
    main_select{{SELECT}}
    main_output(Final Result)

    table_users --> main_where
    main_where --> main_select
    main_select --> main_output
`);
        });

        it('should generate complete Mermaid for SELECT with ORDER BY', () => {
            const sql = 'SELECT id, name FROM users ORDER BY name';
            
            const result = generator.generateMermaidFlow(sql);
            
            expect(result).toBe(`flowchart TD
    table_users[(users)]
    main_select{{SELECT}}
    main_order_by{{ORDER BY}}
    main_output(Final Result)

    table_users --> main_select
    main_select --> main_order_by
    main_order_by --> main_output
`);
        });

        it('should generate complete Mermaid for SELECT with GROUP BY', () => {
            const sql = 'SELECT status, COUNT(*) FROM users GROUP BY status';
            
            const result = generator.generateMermaidFlow(sql);
            
            expect(result).toBe(`flowchart TD
    table_users[(users)]
    main_group_by{{GROUP BY}}
    main_select{{SELECT}}
    main_output(Final Result)

    table_users --> main_group_by
    main_group_by --> main_select
    main_select --> main_output
`);
        });

        it('should generate complete Mermaid for SELECT with LIMIT', () => {
            const sql = 'SELECT id, name FROM users LIMIT 10';
            
            const result = generator.generateMermaidFlow(sql);
            
            expect(result).toBe(`flowchart TD
    table_users[(users)]
    main_select{{SELECT}}
    main_limit{{LIMIT}}
    main_output(Final Result)

    table_users --> main_select
    main_select --> main_limit
    main_limit --> main_output
`);
        });
    });

    describe('JOIN Queries', () => {
        it('should generate complete Mermaid for simple INNER JOIN', () => {
            const sql = `
                SELECT u.name, p.title
                FROM users u
                INNER JOIN posts p ON u.id = p.author_id
            `;
            
            const result = generator.generateMermaidFlow(sql);
            
            expect(result).toBe(`flowchart TD
    table_users[(users)]
    table_posts[(posts)]
    join_1{INNER JOIN}
    main_select{{SELECT}}
    main_output(Final Result)

    table_users -->|NOT NULL| join_1
    table_posts -->|NOT NULL| join_1
    join_1 --> main_select
    main_select --> main_output
`);
        });

        it('should generate complete Mermaid for LEFT JOIN', () => {
            const sql = `
                SELECT u.name, p.title
                FROM users u
                LEFT JOIN posts p ON u.id = p.author_id
            `;
            
            const result = generator.generateMermaidFlow(sql);
            
            expect(result).toBe(`flowchart TD
    table_users[(users)]
    table_posts[(posts)]
    join_1{LEFT JOIN}
    main_select{{SELECT}}
    main_output(Final Result)

    table_users -->|NOT NULL| join_1
    table_posts -->|NULLABLE| join_1
    join_1 --> main_select
    main_select --> main_output
`);
        });
    });

    describe('UNION Queries', () => {
        it('should generate complete Mermaid for simple UNION ALL', () => {
            const sql = `
                SELECT name FROM users
                UNION ALL
                SELECT name FROM admins
            `;
            
            const result = generator.generateMermaidFlow(sql);
            
            expect(result).toBe(`flowchart TD
    table_users[(users)]
    main_left_select{{SELECT}}
    table_admins[(admins)]
    main_right_select{{SELECT}}
    union_all_main{UNION ALL}

    table_users --> main_left_select
    table_admins --> main_right_select
    main_left_select --> union_all_main
    main_right_select --> union_all_main
`);
        });
    });

    describe('Simple CTE Queries', () => {
        it('should generate flow for basic CTE', () => {
            const sql = `
                WITH active_users AS (
                    SELECT id, name FROM users WHERE active = true
                )
                SELECT * FROM active_users
            `;
            
            const result = generator.generateMermaidFlow(sql);
            
            expect(result).toContain('cte_active_users[(CTE:active_users)]');
            expect(result).toContain('table_users[(users)]');
            expect(result).toContain('cte_active_users_where{{WHERE}}');
            expect(result).toContain('cte_active_users_select{{SELECT}}');
            expect(result).toContain('cte_active_users --> main_select');
        });
    });

    describe('Simple Subquery Tests', () => {
        it('should generate flow for subquery in FROM clause', () => {
            const sql = `
                SELECT * FROM (
                    SELECT id, name FROM users WHERE active = true
                ) active_users
            `;
            
            const result = generator.generateMermaidFlow(sql);
            
            expect(result).toContain('subquery_active_users[(QUERY:active_users)]');
            expect(result).toContain('table_users[(users)]');
            expect(result).toContain('subquery_active_users --> main_select');
        });
    });

    describe('Complex Queries', () => {
        it('should generate complete Mermaid for complex CTE with subquery and UNION', () => {
            const sql = `
                WITH user_stats AS (
                    SELECT u.id, u.name, COUNT(p.id) as post_count
                    FROM users u
                    LEFT JOIN posts p ON u.id = p.author_id
                    GROUP BY u.id, u.name
                )
                SELECT * FROM (
                    SELECT id, name, post_count FROM user_stats
                    UNION ALL
                    SELECT admin_id as id, name, 0 as post_count FROM admins
                ) as combined
                WHERE post_count > 0
            `;
            
            const result = generator.generateMermaidFlow(sql);
            
            expect(result).toBe(`flowchart TD
    cte_user_stats[(CTE:user_stats)]
    table_users[(users)]
    table_posts[(posts)]
    join_1{LEFT JOIN}
    cte_user_stats_group_by{{GROUP BY}}
    cte_user_stats_select{{SELECT}}
    subquery_combined[(QUERY:combined)]
    subquery_combined_internal_left_select{{SELECT}}
    table_admins[(admins)]
    subquery_combined_internal_right_select{{SELECT}}
    union_all_subquery_combined_internal{UNION ALL}
    main_where{{WHERE}}
    main_select{{SELECT}}
    main_output(Final Result)

    table_users -->|NOT NULL| join_1
    table_posts -->|NULLABLE| join_1
    join_1 --> cte_user_stats_group_by
    cte_user_stats_group_by --> cte_user_stats_select
    cte_user_stats_select --> cte_user_stats
    cte_user_stats --> subquery_combined_internal_left_select
    table_admins --> subquery_combined_internal_right_select
    subquery_combined_internal_left_select --> union_all_subquery_combined_internal
    subquery_combined_internal_right_select --> union_all_subquery_combined_internal
    union_all_subquery_combined_internal --> subquery_combined
    subquery_combined --> main_where
    main_where --> main_select
    main_select --> main_output
`);
        });
    });

    describe('Mermaid Format Options', () => {
        it('should support direction option', () => {
            const sql = 'SELECT id FROM users';
            
            const resultTD = generator.generateMermaidFlow(sql, { direction: 'TD' });
            const resultLR = generator.generateMermaidFlow(sql, { direction: 'LR' });
            
            expect(resultTD).toMatch(/^flowchart TD\n/);
            expect(resultLR).toMatch(/^flowchart LR\n/);
        });

        it('should support title option', () => {
            const sql = 'SELECT id FROM users';
            
            const result = generator.generateMermaidFlow(sql, { title: 'Test Query Flow' });
            
            expect(result).toContain('%% Test Query Flow');
        });
    });
});