import { describe, it, expect } from 'vitest';

describe('Verify Actual Duplicates from Report', () => {
    it('should manually count Region and Customer type duplicates in the report output', () => {
        // Exact formatted SQL text from the report (Before Comma Style section)
        const formattedSQL = `/* Main query: Sales analysis report */
WITH
    /* Raw data preparation */
    "raw_sales" AS (
        SELECT
            "s"."sale_id" /* Sale ID */
            , "s"."sale_date" /* Sale date */
            , "s"."customer_id" /* Customer ID */
            , "s"."product_id" /* Product ID */
            , "s"."quantity" /* Quantity */
            , "s"."unit_price" /* Unit price */
            , "s"."discount_rate" /* Discount rate */
            , /* Net amount calculation */ "s"."quantity" * "s"."unit_price" * (1 - "s"."discount_rate") AS "net_amount"
        FROM
            "sales" AS "s" /* Sales table */
        WHERE
            "s"."sale_date" >= '2023-01-01' /* Period filter */
            and "s"."sale_date" < '2024-01-01' and "s"."quantity" > 0 /* Valid sales only */
    )
    , /* Customer master data */
    "customer_master" AS (
        SELECT
            "c"."customer_id"
            , "c"."customer_name" /* Customer name */
            , "c"."region" /* Region */
            , "c"."customer_type" /* Customer type */
            , "c"."registration_date" /* Registration date */
        FROM
            "customers" AS "c"
        WHERE
            "c"."active_flag" = 1 /* Active customers only */
    )
    , /* Regional summary */
    "regional_summary" AS (
        SELECT
            "region" /* Region */
            , "customer_type" /* Customer type */
            , count(distinct "customer_id") AS "customer_count" /* Customer count */
            , sum("net_amount") AS "total_sales" /* Total sales */
        FROM
            "enriched_sales"
        GROUP BY
            "region"
            , "customer_type"
        HAVING
            sum("net_amount") > 10000 /* Regions with sales over 10K only */
    )
SELECT
    "fr"."sales_rank" /* Rank */
    , "fr"."region" /* Region name */
    , "fr"."customer_type" /* Customer type */
FROM
    "final_report" AS "fr"`;

        console.log('🔍 Manual duplicate verification...');

        // Extract all comment texts manually
        const commentMatches = formattedSQL.match(/\/\*[^*]*\*+(?:[^/*][^*]*\*+)*\//g) || [];
        const commentTexts = commentMatches.map(match =>
            match.replace(/^\/\*\s*|\s*\*\/$/g, '').trim()
        );

        console.log('\n📝 All comment texts:');
        commentTexts.forEach((text, index) => {
            console.log(`[${index}] "${text}"`);
        });

        // Count specific duplicates
        const regionCount = commentTexts.filter(text => text === 'Region').length;
        const regionNameCount = commentTexts.filter(text => text === 'Region name').length;
        const customerTypeCount = commentTexts.filter(text => text === 'Customer type').length;

        console.log('\n📊 Manual count verification:');
        console.log(`- "Region" appears: ${regionCount} times`);
        console.log(`- "Region name" appears: ${regionNameCount} times`);
        console.log(`- "Customer type" appears: ${customerTypeCount} times`);

        // Identify exact duplicates
        const duplicatedTexts = {};
        commentTexts.forEach(text => {
            duplicatedTexts[text] = (duplicatedTexts[text] || 0) + 1;
        });

        const actualDuplicates = Object.entries(duplicatedTexts)
            .filter(([text, count]) => count > 1)
            .map(([text, count]) => ({ text, count }));

        console.log('\n⚠️ Actual duplications found:');
        actualDuplicates.forEach(({ text, count }) => {
            console.log(`- "${text}" appears ${count} times`);
        });

        console.log(`\n📈 Total duplicate types: ${actualDuplicates.length}`);

        expect(true).toBe(true);
    });
});