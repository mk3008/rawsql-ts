import { describe, test, expect, beforeEach } from 'vitest';
import { CTEDependencyAnalyzer } from '../../src/transformers/CTEDependencyAnalyzer';
import { SimpleSelectQuery } from '../../src/models/SimpleSelectQuery';
import { SelectQueryParser } from '../../src/parsers/SelectQueryParser';

describe('CTEDependencyAnalyzer - Complex UNION Query', () => {
    let analyzer: CTEDependencyAnalyzer;

    beforeEach(() => {
        analyzer = new CTEDependencyAnalyzer();
    });

    test('should analyze complex CTE dependencies with UNION ALL in main query', () => {
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

        const parsedQuery = SelectQueryParser.parse(sql);
        const query = parsedQuery as SimpleSelectQuery;
        const graph = analyzer.analyzeDependencies(query);

        // Check details in logs
        console.log('\n=== CTE Dependency Analysis (Breaking Change) ===');
        console.log('Total nodes found:', graph.nodes.length);
        console.log('Total edges (dependencies):', graph.edges.length);
        
        graph.nodes.forEach(node => {
            console.log(`Node "${node.name}" (${node.type}): depends on [${node.dependencies.join(', ')}]`);
        });

        console.log('\nExecution order:', analyzer.getExecutionOrder());

        // After breaking change: 7 CTEs + 1 MAIN_QUERY = 8 nodes
        expect(graph.nodes).toHaveLength(8);
        
        // Check only CTE nodes
        const cteNodes = analyzer.getNodesByType('CTE');
        expect(cteNodes).toHaveLength(7);

        // Check specific dependencies
        expect(analyzer.getDependencies('session_data')).toEqual([]);
        expect(analyzer.getDependencies('user_engagement')).toEqual(['session_data']);
        expect(analyzer.getDependencies('conversion_events')).toEqual([]);
        expect(analyzer.getDependencies('funnel_analysis')).toEqual(['conversion_events']);
        expect(analyzer.getDependencies('device_analysis')).toEqual(['session_data']);
        expect(analyzer.getDependencies('channel_performance').sort()).toEqual(['funnel_analysis', 'session_data']);
        expect(analyzer.getDependencies('user_cohorts').sort()).toEqual(['funnel_analysis', 'user_engagement']);
        
        // Check main query dependencies (references 3 CTEs in UNION)
        expect(analyzer.getDependencies('MAIN_QUERY').sort()).toEqual(['channel_performance', 'device_analysis', 'user_cohorts']);

        // Check if execution order respects dependencies
        const executionOrder = analyzer.getExecutionOrder();
        expect(executionOrder).toHaveLength(8); // 7 CTEs + 1 MAIN_QUERY
        
        // user_engagement should come after session_data
        const sessionDataIndex = executionOrder.indexOf('session_data');
        const userEngagementIndex = executionOrder.indexOf('user_engagement');
        expect(sessionDataIndex).toBeLessThan(userEngagementIndex);
        
        // funnel_analysis should come after conversion_events
        const conversionEventsIndex = executionOrder.indexOf('conversion_events');
        const funnelAnalysisIndex = executionOrder.indexOf('funnel_analysis');
        expect(conversionEventsIndex).toBeLessThan(funnelAnalysisIndex);
        
        // channel_performance should come after session_data and funnel_analysis
        const channelPerformanceIndex = executionOrder.indexOf('channel_performance');
        expect(sessionDataIndex).toBeLessThan(channelPerformanceIndex);
        expect(funnelAnalysisIndex).toBeLessThan(channelPerformanceIndex);
        
        // user_cohorts should come after user_engagement and funnel_analysis
        const userCohortsIndex = executionOrder.indexOf('user_cohorts');
        expect(userEngagementIndex).toBeLessThan(userCohortsIndex);
        expect(funnelAnalysisIndex).toBeLessThan(userCohortsIndex);
        
        // MAIN_QUERY should be executed last
        const mainQueryIndex = executionOrder.indexOf('MAIN_QUERY');
        expect(mainQueryIndex).toBe(7); // Last index
        expect(userCohortsIndex).toBeLessThan(mainQueryIndex);
        expect(channelPerformanceIndex).toBeLessThan(mainQueryIndex);

        // Confirm no circular dependencies
        expect(analyzer.hasCircularDependency()).toBe(false);
    });
});