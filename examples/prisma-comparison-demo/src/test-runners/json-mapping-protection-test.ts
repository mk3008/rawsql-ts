/**
 * Simple test for JsonMapping type protection
 */

import { PrismaClient } from '@prisma/client';
import { RawSqlClient } from '../../../../packages/prisma-integration/src/RawSqlClient';
import * as path from 'path';

const prisma = new PrismaClient({
    log: ['query', 'info', 'warn', 'error'],
});

async function testJsonMappingTypeProtection() {
    console.log('🔒 Testing JsonMapping Type Protection');
    console.log('='.repeat(50));

    try {
        // Use absolute path for cross-platform compatibility
        const sqlFilesPath = path.join(__dirname, '..', '..', 'rawsql-ts');
        const rawSqlClient = new RawSqlClient(prisma, {
            debug: true,
            sqlFilesPath: sqlFilesPath
        });

        console.log('\n📋 Step 1: Execute query with type-protected JsonMapping');
        console.log('-'.repeat(50));

        // Execute the query with the updated JsonMapping that has type protection
        const result = await rawSqlClient.queryOne('getTodoDetail.sql', { filter: { id: 1 } });

        console.log('\n🔍 Analyzing protected result:');
        if (result && typeof result === 'object') {
            const todoArray = Array.isArray(result) ? result : [result];
            const todo = todoArray[0];
            if (todo) {
                console.log(`  title: ${typeof todo.title} - "${todo.title}"`);
                console.log(`  description: ${typeof todo.description} - "${todo.description}"`);
                console.log(`  createdAt: ${typeof todo.createdAt} - ${todo.createdAt instanceof Date ? todo.createdAt.toISOString() : todo.createdAt}`);

                if (todo.user) {
                    console.log(`  user.userName: ${typeof todo.user.userName} - "${todo.user.userName}"`);
                    console.log(`  user.email: ${typeof todo.user.email} - "${todo.user.email}"`);
                    console.log(`  user.createdAt: ${typeof todo.user.createdAt} - ${todo.user.createdAt instanceof Date ? todo.user.createdAt.toISOString() : todo.user.createdAt}`);
                }

                if (todo.category) {
                    console.log(`  category.categoryName: ${typeof todo.category.categoryName} - "${todo.category.categoryName}"`);
                    console.log(`  category.color: ${typeof todo.category.color} - "${todo.category.color}"`);
                }

                if (todo.comments && Array.isArray(todo.comments) && todo.comments.length > 0) {
                    console.log(`  comments[0].commentText: ${typeof todo.comments[0].commentText} - "${todo.comments[0].commentText}"`);
                }
            }
        }

        console.log('\n✅ JsonMapping type protection test completed!');

    } catch (error) {
        console.error('❌ Error during JsonMapping type protection test:', error);
    } finally {
        await prisma.$disconnect();
    }
}

// Run the test
testJsonMappingTypeProtection().catch(console.error);
