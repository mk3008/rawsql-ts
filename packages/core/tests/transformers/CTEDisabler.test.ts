import { describe, expect, test } from 'vitest';
import { CTEDisabler } from '../../src/transformers/CTEDisabler';
import { SelectQueryParser } from '../../src/parsers/SelectQueryParser';
import { Formatter } from '../../src/transformers/Formatter';

const formatter = new Formatter();

describe('CTEDisabler', () => {
    test('disables simple WITH clause', () => {
        // Arrange
        const sql = `
            WITH temp_sales AS (
                SELECT * FROM sales WHERE date >= '2024-01-01'
            )
            SELECT * FROM temp_sales
        `;
        const query = SelectQueryParser.parse(sql);
        const disabler = new CTEDisabler();

        // Act
        const disabledQuery = disabler.visit(query);
        const result = formatter.format(disabledQuery);

        // Assert
        expect(result).toBe('select * from "temp_sales"');
    });

    test('disables multiple WITH clauses', () => {
        // Arrange
        const sql = `
            WITH 
                sales_2024 AS (
                    SELECT * FROM sales WHERE year = 2024
                ),
                top_products AS (
                    SELECT product_id, SUM(quantity) as total 
                    FROM sales_2024 
                    GROUP BY product_id 
                    ORDER BY total DESC 
                    LIMIT 10
                )
            SELECT p.name, tp.total
            FROM products p
            JOIN top_products tp ON p.id = tp.product_id
        `;
        const query = SelectQueryParser.parse(sql);
        const disabler = new CTEDisabler();

        // Act
        const disabledQuery = disabler.visit(query);
        const result = formatter.format(disabledQuery);

        // Assert
        expect(result).toBe('select "p"."name", "tp"."total" from "products" as "p" join "top_products" as "tp" on "p"."id" = "tp"."product_id"');
    });

    test('disables recursive WITH clause', () => {
        // Arrange
        const sql = `
            WITH RECURSIVE employees_path(id, name, path) AS (
                SELECT id, name, CAST(id AS TEXT) as path 
                FROM employees 
                WHERE manager_id IS NULL
                UNION ALL
                SELECT e.id, e.name, ep.path || '->' || CAST(e.id AS TEXT)
                FROM employees e 
                JOIN employees_path ep ON e.manager_id = ep.id
            )
            SELECT * FROM employees_path
        `;
        const query = SelectQueryParser.parse(sql);
        const disabler = new CTEDisabler();

        // Act
        const disabledQuery = disabler.visit(query);
        const result = formatter.format(disabledQuery);

        // Assert
        expect(result).toBe('select * from "employees_path"');
    });

    test('disables nested WITH clauses in subqueries', () => {
        // Arrange
        const sql = `
            SELECT * 
            FROM (
                WITH nested_cte AS (
                    SELECT id, value FROM data WHERE type = 'important'
                )
                SELECT * FROM nested_cte
            ) AS subquery
        `;
        const query = SelectQueryParser.parse(sql);
        const disabler = new CTEDisabler();

        // Act
        const disabledQuery = disabler.visit(query);
        const result = formatter.format(disabledQuery);

        // Assert
        expect(result).toBe('select * from (select * from "nested_cte") as "subquery"');
    });

    test('disables WITH clauses in both parts of UNION queries', () => {
        // Arrange
        const sql = `
            WITH cte1 AS (SELECT id FROM table1)
            SELECT * FROM cte1
            UNION
            WITH cte2 AS (SELECT id FROM table2)
            SELECT * FROM cte2
        `;
        const query = SelectQueryParser.parse(sql);
        const disabler = new CTEDisabler();

        // Act
        const disabledQuery = disabler.visit(query);
        const result = formatter.format(disabledQuery);

        // Assert
        expect(result).toBe('select * from "cte1" union select * from "cte2"');
    });

    test('disables WITH clauses in complex query with multiple nesting levels', () => {
        // Arrange
        const sql = `
            WITH outer_cte AS (
                SELECT * FROM (
                    WITH inner_cte AS (
                        SELECT id, name FROM users
                    )
                    SELECT ic.*
                    FROM inner_cte ic
                    JOIN (
                        WITH deepest_cte AS (
                            SELECT * FROM profiles
                        )
                        SELECT * FROM deepest_cte
                    ) AS deep ON ic.id = deep.user_id
                ) AS mid
            )
            SELECT * FROM outer_cte
        `;
        const query = SelectQueryParser.parse(sql);
        const disabler = new CTEDisabler();

        // Act
        const disabledQuery = disabler.visit(query);
        const result = formatter.format(disabledQuery);

        // Assert
        expect(result).toBe('select * from "outer_cte"');
    });

    test('disables WITH clauses in WHERE clause subqueries', () => {
        // Arrange
        const sql = `
            SELECT *
            FROM users
            WHERE department_id IN (
                WITH top_departments AS (
                    SELECT id FROM departments WHERE budget > 1000000
                )
                SELECT id FROM top_departments
            )
        `;
        const query = SelectQueryParser.parse(sql);
        const disabler = new CTEDisabler();

        // Act
        const disabledQuery = disabler.visit(query);
        const result = formatter.format(disabledQuery);

        // Assert
        expect(result).toBe('select * from "users" where "department_id" in (select "id" from "top_departments")');
    });

    test('preserves query semantics after disabling WITH clauses', () => {
        // Arrange
        const sql = `
            WITH filtered_data AS (
                SELECT * FROM raw_data WHERE status = 'active'
            )
            SELECT 
                id, 
                name, 
                COUNT(*) as total_count
            FROM filtered_data
            GROUP BY id, name
            HAVING COUNT(*) > 10
            ORDER BY total_count DESC
            LIMIT 5
        `;
        const query = SelectQueryParser.parse(sql);
        const disabler = new CTEDisabler();

        // Act
        const disabledQuery = disabler.visit(query);
        const result = formatter.format(disabledQuery);

        // Assert
        expect(result).toBe('select "id", "name", count(*) as "total_count" from "filtered_data" group by "id", "name" having count(*) > 10 order by "total_count" desc limit 5');
    });

    test('properly handles circular references', () => {
        // Arrange
        const sql = `
            WITH cte1 AS (
                SELECT * FROM table1 WHERE id IN (SELECT id FROM table2)
            )
            SELECT * 
            FROM cte1
            WHERE id IN (
                SELECT id FROM cte1 WHERE name = 'test'
            )
        `;
        const query = SelectQueryParser.parse(sql);
        const disabler = new CTEDisabler();

        // Act
        const disabledQuery = disabler.visit(query);
        const result = formatter.format(disabledQuery);

        // Assert
        expect(result).toBe('select * from "cte1" where "id" in (select "id" from "cte1" where "name" = \'test\')');
    });

    test('processes complex SQL query with multiple CTEs and UNION ALL', () => {
        // Arrange
        const sql = `
            WITH session_data AS (
                SELECT 
                    user_id,
                    session_id,
                    start_time,
                    end_time,
                    EXTRACT(EPOCH FROM (end_time - start_time)) / 60 as session_duration_minutes,
                    page_views,
                    actions_taken,
                    device_type,
                    browser,
                    source_channel
                FROM user_sessions 
                WHERE start_time >= CURRENT_DATE - INTERVAL '7 days'
                  AND end_time IS NOT NULL
                  AND EXTRACT(EPOCH FROM (end_time - start_time)) >= 30
            ),
            user_engagement AS (
                SELECT 
                    user_id,
                    COUNT(DISTINCT session_id) as total_sessions,
                    COUNT(DISTINCT DATE(start_time)) as active_days,
                    SUM(session_duration_minutes) as total_time_spent,
                    AVG(session_duration_minutes) as avg_session_duration,
                    SUM(page_views) as total_page_views,
                    SUM(actions_taken) as total_actions,
                    MAX(start_time) as last_session_time,
                    MIN(start_time) as first_session_time
                FROM session_data
                GROUP BY user_id
            ),
            conversion_events AS (
                SELECT 
                    user_id,
                    event_type,
                    event_time,
                    session_id,
                    event_value,
                    ROW_NUMBER() OVER (PARTITION BY user_id, event_type ORDER BY event_time) as event_sequence
                FROM events 
                WHERE event_time >= CURRENT_DATE - INTERVAL '7 days'
                  AND event_type IN ('add_to_cart', 'checkout_start', 'purchase_complete', 'signup')
            ),
            funnel_analysis AS (
                SELECT 
                    ce.user_id,
                    MAX(CASE WHEN ce.event_type = 'signup' THEN 1 ELSE 0 END) as has_signup,
                    MAX(CASE WHEN ce.event_type = 'add_to_cart' THEN 1 ELSE 0 END) as has_add_to_cart,
                    MAX(CASE WHEN ce.event_type = 'checkout_start' THEN 1 ELSE 0 END) as has_checkout_start,
                    MAX(CASE WHEN ce.event_type = 'purchase_complete' THEN 1 ELSE 0 END) as has_purchase,
                    COUNT(CASE WHEN ce.event_type = 'add_to_cart' THEN 1 END) as cart_additions,
                    COUNT(CASE WHEN ce.event_type = 'purchase_complete' THEN 1 END) as purchases,
                    SUM(CASE WHEN ce.event_type = 'purchase_complete' THEN ce.event_value ELSE 0 END) as total_purchase_value
                FROM conversion_events ce
                GROUP BY ce.user_id
            ),
            device_analysis AS (
                SELECT 
                    device_type,
                    browser,
                    COUNT(DISTINCT user_id) as unique_users,
                    COUNT(DISTINCT session_id) as total_sessions,
                    AVG(session_duration_minutes) as avg_session_duration,
                    AVG(page_views) as avg_page_views_per_session,
                    AVG(actions_taken) as avg_actions_per_session
                FROM session_data
                GROUP BY device_type, browser
            ),
            channel_performance AS (
                SELECT 
                    source_channel,
                    COUNT(DISTINCT user_id) as unique_visitors,
                    COUNT(DISTINCT session_id) as total_sessions,
                    AVG(session_duration_minutes) as avg_session_duration,
                    SUM(CASE WHEN fa.has_signup = 1 THEN 1 ELSE 0 END) as signups,
                    SUM(CASE WHEN fa.has_purchase = 1 THEN 1 ELSE 0 END) as conversions,
                    SUM(fa.total_purchase_value) as revenue_generated
                FROM session_data sd
                LEFT JOIN funnel_analysis fa ON sd.user_id = fa.user_id
                GROUP BY source_channel
            ),
            user_cohorts AS (
                SELECT 
                    ue.user_id,
                    u.registration_date,
                    DATE_TRUNC('week', u.registration_date) as cohort_week,
                    ue.total_sessions,
                    ue.active_days,
                    ue.total_time_spent,
                    fa.has_purchase,
                    fa.total_purchase_value,
                    CASE 
                        WHEN ue.total_sessions >= 10 AND ue.active_days >= 5 THEN 'Highly Engaged'
                        WHEN ue.total_sessions >= 5 AND ue.active_days >= 3 THEN 'Moderately Engaged'
                        WHEN ue.total_sessions >= 2 THEN 'Lightly Engaged'
                        ELSE 'Single Session'
                    END as engagement_level
                FROM user_engagement ue
                JOIN users u ON ue.user_id = u.user_id
                LEFT JOIN funnel_analysis fa ON ue.user_id = fa.user_id
                WHERE u.registration_date >= CURRENT_DATE - INTERVAL '30 days'
            )
            SELECT 
                'Engagement Overview' as analysis_type,
                uc.engagement_level as segment,
                COUNT(*) as user_count,
                ROUND(AVG(uc.total_sessions), 2) as avg_sessions,
                ROUND(AVG(uc.active_days), 2) as avg_active_days,
                ROUND(AVG(uc.total_time_spent), 2) as avg_time_spent_minutes,
                ROUND(
                    SUM(CASE WHEN uc.has_purchase = 1 THEN 1 ELSE 0 END)::DECIMAL / COUNT(*) * 100, 
                    2
                ) as conversion_rate_percent,
                ROUND(AVG(uc.total_purchase_value), 2) as avg_purchase_value
            FROM user_cohorts uc
            GROUP BY uc.engagement_level

            UNION ALL

            SELECT 
                'Channel Analysis' as analysis_type,
                cp.source_channel as segment,
                cp.unique_visitors as user_count,
                ROUND(cp.avg_session_duration, 2) as avg_sessions,
                cp.total_sessions as avg_active_days,
                0 as avg_time_spent_minutes,
                ROUND(
                    CASE 
                        WHEN cp.unique_visitors > 0 
                        THEN (cp.conversions::DECIMAL / cp.unique_visitors) * 100 
                        ELSE 0 
                    END, 2
                ) as conversion_rate_percent,
                ROUND(cp.revenue_generated, 2) as avg_purchase_value
            FROM channel_performance cp

            UNION ALL

            SELECT 
                'Device Performance' as analysis_type,
                CONCAT(da.device_type, ' - ', da.browser) as segment,
                da.unique_users as user_count,
                ROUND(da.avg_session_duration, 2) as avg_sessions,
                da.total_sessions as avg_active_days,
                ROUND(da.avg_page_views_per_session, 2) as avg_time_spent_minutes,
                ROUND(da.avg_actions_per_session, 2) as conversion_rate_percent,
                0 as avg_purchase_value
            FROM device_analysis da

            ORDER BY 
                CASE analysis_type
                    WHEN 'Engagement Overview' THEN 1
                    WHEN 'Channel Analysis' THEN 2
                    WHEN 'Device Performance' THEN 3
                END,
                user_count DESC
        `;
        
        const query = SelectQueryParser.parse(sql);
        const disabler = new CTEDisabler();

        // Act & Assert
        // This test verifies that CTEDisabler can process complex queries with multiple CTEs and UNION ALL
        // without throwing exceptions. If it fails, it indicates areas that need improvement.
        let result: string;
        let error: Error | null = null;
        
        try {
            const disabledQuery = disabler.visit(query);
            result = formatter.format(disabledQuery);
            // If we reach here, the transformation succeeded
            expect(result).toBeDefined();
            expect(result.length).toBeGreaterThan(0);
            // The result should not contain WITH clauses
            expect(result.toLowerCase()).not.toContain('with ');
        } catch (e) {
            error = e as Error;
            // If there's an error, we want to document it clearly for the next PR step
            console.error('CTEDisabler failed to process complex query:', error.message);
            console.error('Error stack:', error.stack);
            
            // Re-throw to make the test fail and show the issue
            throw new Error(`CTEDisabler failed to process complex query with multiple CTEs and UNION ALL: ${error.message}`);
        }
    });
});