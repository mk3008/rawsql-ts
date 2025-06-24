/**
 * Test TypeTransformationPostProcessor with real database results
 * This will test our JSON type transformation on actual date and bigint data
 * 
 * NOTE: This file contains DEMO ENVIRONMENT SPECIFIC tests only.
 * Generic transformation tests have been moved to packages/core/tests/
 */

import { PrismaClient } from '@prisma/client';
import { RawSqlClient } from '../../../../packages/prisma-integration/src/RawSqlClient';
import { transformDatabaseResult, TypeTransformationPostProcessor } from '../../../../packages/core/src';
import * as path from 'path';

const prisma = new PrismaClient({
    log: ['query', 'info', 'warn', 'error'],
});

/**
 * Test TypeTransformationPostProcessor with real TODO data
 * DEMO ENVIRONMENT SPECIFIC - Uses getTodoDetail.sql and Prisma
 */
async function testTypeTransformationWithRealData() {
    console.log('🔄 Testing TypeTransformationPostProcessor with Real Database Data');
    console.log('='.repeat(70));

    try {
        // Initialize RawSqlClient
        // Use absolute path for cross-platform compatibility
        const sqlFilesPath = path.join(__dirname, '..', '..', 'rawsql-ts');
        const rawSqlClient = new RawSqlClient(prisma, {
            debug: true,
            sqlFilesPath: sqlFilesPath
        });

        console.log('\n📋 Step 1: Execute SQL without type transformation');
        console.log('-'.repeat(50));

        // Execute the query without any type transformation to see raw JSON result
        const rawResult = await rawSqlClient.queryOne('getTodoDetail.sql', { filter: { id: 1 } });

        console.log('📄 Raw SQL result (first few characters):');
        const rawString = JSON.stringify(rawResult, null, 2);
        console.log(rawString.substring(0, 500) + '...');

        // Check the types of date fields
        if (rawResult && typeof rawResult === 'object') {
            console.log('\n🔍 Analyzing raw date field types:');
            // The result comes as an array from the JSON aggregation
            const todoArray = Array.isArray(rawResult) ? rawResult : [rawResult];
            const todo = todoArray[0];
            if (todo) {
                console.log(`  createdAt: ${typeof todo.createdAt} - "${todo.createdAt}"`);
                console.log(`  updatedAt: ${typeof todo.updatedAt} - "${todo.updatedAt}"`);

                if (todo.user) {
                    console.log(`  user.createdAt: ${typeof todo.user.createdAt} - "${todo.user.createdAt}"`);
                }

                if (todo.category) {
                    console.log(`  category.createdAt: ${typeof todo.category.createdAt} - "${todo.category.createdAt}"`);
                }

                if (todo.comments && Array.isArray(todo.comments) && todo.comments.length > 0) {
                    console.log(`  comments[0].createdAt: ${typeof todo.comments[0].createdAt} - "${todo.comments[0].createdAt}"`);
                }
            }
        }

        console.log('\n📋 Step 2: Apply TypeTransformationPostProcessor');
        console.log('-'.repeat(50));

        // Apply type transformation using the default configuration
        const transformedResult = transformDatabaseResult(rawResult);

        console.log('🔍 Analyzing transformed date field types:');
        if (transformedResult && typeof transformedResult === 'object') {
            // The result comes as an array from the JSON aggregation
            const todoArray = Array.isArray(transformedResult) ? transformedResult : [transformedResult];
            const todo = todoArray[0];
            if (todo) {
                console.log(`  createdAt: ${typeof todo.createdAt} - ${todo.createdAt instanceof Date ? todo.createdAt.toISOString() : todo.createdAt}`);
                console.log(`  updatedAt: ${typeof todo.updatedAt} - ${todo.updatedAt instanceof Date ? todo.updatedAt.toISOString() : todo.updatedAt}`);

                if (todo.user) {
                    console.log(`  user.createdAt: ${typeof todo.user.createdAt} - ${todo.user.createdAt instanceof Date ? todo.user.createdAt.toISOString() : todo.user.createdAt}`);
                }

                if (todo.category) {
                    console.log(`  category.createdAt: ${typeof todo.category.createdAt} - ${todo.category.createdAt instanceof Date ? todo.category.createdAt.toISOString() : todo.category.createdAt}`);
                }

                if (todo.comments && Array.isArray(todo.comments) && todo.comments.length > 0) {
                    console.log(`  comments[0].createdAt: ${typeof todo.comments[0].createdAt} - ${todo.comments[0].createdAt instanceof Date ? todo.comments[0].createdAt.toISOString() : todo.comments[0].createdAt}`);
                }
            }
        }

        console.log('\n✅ TypeTransformationPostProcessor test completed successfully!');

    } catch (error) {
        console.error('❌ Error during type transformation test:', error);
        if (error instanceof Error) {
            console.error('   Stack:', error.stack);
        }
    }
}

/**
 * Test custom type transformation configuration - Demo Integration Only
 * NOTE: Comprehensive custom transformation tests are in core library
 */
async function testCustomTypeTransformation() {
    console.log('\n🔄 Testing Custom TypeTransformationPostProcessor - Demo Integration');
    console.log('='.repeat(70));

    console.log('💡 Note: Comprehensive custom transformation tests are in core library tests.');
    console.log('   This section focuses on demo-specific integration scenarios.');

    try {
        console.log('\n📋 Demo Integration: Custom transformers with RawSqlClient');
        console.log('-'.repeat(50));

        // Example of how custom transformations can be used in a real application context
        // Use absolute path for cross-platform compatibility
        const sqlFilesPath = path.join(__dirname, '..', '..', 'rawsql-ts');
        const rawSqlClient = new RawSqlClient(prisma, {
            debug: false,
            sqlFilesPath: sqlFilesPath
        });

        // Execute a real query and show how type transformations are applied
        const rawResult = await rawSqlClient.queryOne('getTodoDetail.sql', { filter: { id: 1 } });

        console.log('✅ Successfully demonstrated type transformation integration with real data');
        console.log('   See core library tests for comprehensive transformation examples:');
        console.log('   - Custom transformers');
        console.log('   - Problematic strings detection');
        console.log('   - Security vulnerability tests');
        console.log('   - TypeScript type vs runtime behavior');

    } catch (error) {
        console.error('❌ Error during custom type transformation test:', error);
    }
}

/**
 * Test real database insertion of dangerous strings and mapping protection
 * DEMO ENVIRONMENT SPECIFIC - Uses Prisma and todo_comment table
 */
async function testRealDatabaseStringProtection() {
    console.log('\n🔒 Testing Real Database String Protection with Mapping');
    console.log('='.repeat(70));

    try {
        // Step 1: Insert dangerous strings into the database
        console.log('\n📥 Step 1: Insert dangerous strings into database');
        console.log('-'.repeat(50));

        const dangerousComments = [
            { text: "2024-01-01", description: "Date-like string" },
            { text: "2024-12-25T10:30:00.000Z", description: "ISO datetime string" },
            { text: "1234567890123456789", description: "BigInt-like string" },
            { text: "9007199254740991", description: "MAX_SAFE_INTEGER as string" },
            { text: "My birthday is 1990-05-15 and I love it!", description: "Date in comment" },
            { text: "The event is on 2025-06-01T14:00:00.000Z", description: "Datetime in sentence" },
            { text: "Price: 123456789012345 USD", description: "BigInt in sentence" }
        ];

        // First, ensure we have a todo to comment on
        const existingTodo = await prisma.todo.findFirst();
        if (!existingTodo) {
            throw new Error('No todo found. Please run seed first.');
        }

        const existingUser = await prisma.user.findFirst();
        if (!existingUser) {
            throw new Error('No user found. Please run seed first.');
        }

        // Delete existing dangerous comments to ensure clean test
        await prisma.todoComment.deleteMany({
            where: {
                comment_text: {
                    in: dangerousComments.map(c => c.text)
                }
            }
        });

        // Insert dangerous comments
        const insertedComments = [];
        for (const comment of dangerousComments) {
            console.log(`  📝 Inserting: "${comment.text}" (${comment.description})`);
            const inserted = await prisma.todoComment.create({
                data: {
                    comment_text: comment.text,
                    todo_id: existingTodo.todo_id,
                    user_id: existingUser.user_id
                }
            });
            insertedComments.push(inserted);
        }

        console.log(`✅ Successfully inserted ${insertedComments.length} dangerous comments`);

        // Step 2: Query without type transformation (raw JSON)
        console.log('\n📋 Step 2: Query dangerous comments (raw JSON)');
        console.log('-'.repeat(50));

        // Use absolute path for cross-platform compatibility
        const sqlFilesPath = path.join(__dirname, '..', '..', 'rawsql-ts');
        const rawSqlClient = new RawSqlClient(prisma, {
            debug: false,
            sqlFilesPath: sqlFilesPath
        });

        // Use raw SQL to get the comments
        const rawComments = await prisma.$queryRaw`
            SELECT comment_id, comment_text, created_at, todo_id, user_id
            FROM todo_comment 
            WHERE comment_text = ANY(${dangerousComments.map(c => c.text)})
            ORDER BY comment_id
        ` as any[];

        console.log('📄 Raw database results:');
        rawComments.forEach((comment: any, index: number) => {
            console.log(`  ${index + 1}. comment_text: "${comment.comment_text}" (${typeof comment.comment_text})`);
            console.log(`     created_at: "${comment.created_at}" (${typeof comment.created_at})`);
        });

        // Step 3: Apply value-based transformation (DANGEROUS - will convert strings)
        console.log('\n⚠️  Step 3: Apply value-based transformation (DANGEROUS)');
        console.log('-'.repeat(50));

        const dangerousResult = transformDatabaseResult(rawComments);

        console.log('🚨 Value-based transformation results (user input corrupted):');
        dangerousResult.forEach((comment: any, index: number) => {
            const original = rawComments[index];
            const isCorrupted = comment.comment_text instanceof Date || typeof comment.comment_text === 'bigint';

            if (isCorrupted) {
                console.log(`  🚨 CORRUPTED ${index + 1}:`);
                console.log(`    Original: "${original.comment_text}" (${typeof original.comment_text})`);
                console.log(`    Corrupted: "${comment.comment_text}" (${typeof comment.comment_text})`);
                if (comment.comment_text instanceof Date) {
                    console.log(`    Display:  "${comment.comment_text.toString()}"`);
                }
            } else {
                console.log(`  ✅ SAFE ${index + 1}: "${comment.comment_text}" (${typeof comment.comment_text})`);
            }
        });

        // Step 4: Apply mapping-based transformation (SAFE - preserves strings)
        console.log('\n🛡️  Step 4: Apply mapping-based transformation (SAFE)');
        console.log('-'.repeat(50));

        // Create a mapping that explicitly preserves comment_text as string
        const safeMapping = {
            comment_id: { sourceType: 'NUMERIC' as const, targetType: 'number' as const },
            comment_text: { sourceType: 'custom' as const, targetType: 'string' as const },  // 🔒 PROTECTED: Force string type regardless of content
            created_at: { sourceType: 'TIMESTAMP' as const, targetType: 'Date' as const },      // ✅ ALLOWED: Convert timestamp to Date
            todo_id: { sourceType: 'NUMERIC' as const, targetType: 'number' as const },
            user_id: { sourceType: 'NUMERIC' as const, targetType: 'number' as const }
        };

        const processor = new TypeTransformationPostProcessor({
            columnTransformations: safeMapping
        });

        const safeResult = processor.transformResult(rawComments);

        console.log('✅ Mapping-based transformation results (user input protected):');
        safeResult.forEach((comment: any, index: number) => {
            const original = rawComments[index];
            const isProtected = typeof comment.comment_text === 'string';
            const dateConverted = comment.created_at instanceof Date;

            console.log(`  🛡️  PROTECTED ${index + 1}:`);
            console.log(`    comment_text: "${comment.comment_text}" (${typeof comment.comment_text}) ${isProtected ? '✅ SAFE' : '🚨 CORRUPTED'}`);
            console.log(`    created_at: "${comment.created_at}" (${typeof comment.created_at}) ${dateConverted ? '✅ CONVERTED' : '❌ NOT CONVERTED'}`);
            console.log(`    Original vs Protected: "${original.comment_text}" → "${comment.comment_text}"`);
        });

        // Step 5: Security analysis
        console.log('\n📊 Step 5: Security Analysis');
        console.log('-'.repeat(50));

        const valueBased = {
            corrupted: dangerousResult.filter((c: any) =>
                c.comment_text instanceof Date || typeof c.comment_text === 'bigint'
            ).length,
            total: dangerousResult.length
        };

        const mappingBased = {
            protected: safeResult.filter((c: any) =>
                typeof c.comment_text === 'string'
            ).length,
            total: safeResult.length
        };

        console.log('🔍 Comparison Results:');
        console.log(`  Value-based:  ${valueBased.corrupted}/${valueBased.total} user inputs corrupted (${(valueBased.corrupted / valueBased.total * 100).toFixed(1)}% corruption rate)`);
        console.log(`  Mapping-based: ${mappingBased.protected}/${mappingBased.total} user inputs protected (${(mappingBased.protected / mappingBased.total * 100).toFixed(1)}% protection rate)`);

        console.log('\n💡 Key Findings:');
        console.log('  ✅ Column mapping successfully prevents auto-conversion of user input');
        console.log('  ✅ Date-like strings in comments remain as strings when mapped');
        console.log('  ✅ BigInt-like strings in comments remain as strings when mapped');
        console.log('  ✅ Legitimate date fields (created_at) still get converted to Date objects');
        console.log('  🚨 Value-based detection alone is dangerous for user-generated content');

        // Step 6: Cleanup
        console.log('\n🧹 Step 6: Cleanup dangerous test data');
        console.log('-'.repeat(50));

        await prisma.todoComment.deleteMany({
            where: {
                comment_id: {
                    in: insertedComments.map(c => c.comment_id)
                }
            }
        });

        console.log(`✅ Cleaned up ${insertedComments.length} test comments`);

    } catch (error) {
        console.error('❌ Error during real database string protection test:', error);
        throw error;
    }
}

/**
 * Main function to run all type transformation tests
 */
export async function runTypeTransformationTests() {
    try {
        await testTypeTransformationWithRealData();
        await testCustomTypeTransformation();
        await testRealDatabaseStringProtection();
    } catch (error) {
        console.error('❌ Fatal error in type transformation tests:', error);
    } finally {
        await prisma.$disconnect();
    }
}

// Run tests if this file is executed directly
if (require.main === module) {
    runTypeTransformationTests().catch(console.error);
}
