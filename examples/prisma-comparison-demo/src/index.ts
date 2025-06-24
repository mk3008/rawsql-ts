#!/usr/bin/env node

import { createInterface } from 'readline';
import { PrismaClient } from '@prisma/client';
import path from 'path';
import { PrismaTodoDetailService } from './services/prisma-todo-detail.service';
import { RawSqlTodoDetailService } from './services/rawsql-todo-detail.service';

/**
 * Interactive demo application that compares Prisma ORM and rawsql-ts
 * for querying TODO data with detailed information including comments
 */

// Initialize Prisma client
const prisma = new PrismaClient();

// Initialize service instances
const prismaService = new PrismaTodoDetailService(prisma);
const rawSqlService = new RawSqlTodoDetailService(prisma, {
    debug: true,  // Enable debug to see internal timing
    disableResolver: true  // Disable resolver for faster startup
});

// Create readline interface for user input
const rl = createInterface({
    input: process.stdin,
    output: process.stdout
});

/**
 * Display application header
 */
function displayHeader(): void {
    console.clear();
    console.log('🚀 Prisma vs rawsql-ts Interactive Demo');
    console.log('======================================');
    console.log('Compare query performance and results between:');
    console.log('• Prisma ORM - Type-safe database toolkit');
    console.log('• rawsql-ts - Raw SQL with type safety');
    console.log('');
}

/**
 * Prompt user to select query method
 */
function promptQueryMethod(): Promise<'prisma' | 'rawsql'> {
    return new Promise((resolve) => {
        console.log('📊 Select query method:');
        console.log('1. Prisma ORM');
        console.log('2. rawsql-ts');
        console.log('');
        rl.question('Enter your choice (1 or 2): ', (answer) => {
            const choice = answer.trim();
            if (choice === '1') {
                resolve('prisma');
            } else if (choice === '2') {
                resolve('rawsql');
            } else {
                console.log('❌ Invalid choice. Please enter 1 or 2.');
                console.log('');
                resolve(promptQueryMethod());
            }
        });
    });
}

/**
 * Prompt user for TODO ID
 */
function promptTodoId(): Promise<number> {
    return new Promise((resolve) => {
        rl.question('🔍 Enter TODO ID to search: ', (answer) => {
            const id = parseInt(answer.trim());
            if (isNaN(id) || id <= 0) {
                console.log('❌ Invalid ID. Please enter a positive number.');
                console.log('');
                resolve(promptTodoId());
            } else {
                resolve(id);
            }
        });
    });
}

/**
 * Fetch TODO using Prisma ORM
 */
async function fetchTodoWithPrisma(id: number): Promise<any> {
    console.log('⚡ Querying with Prisma ORM...');
    console.log('');

    const startTime = performance.now();
    const result = await prismaService.getTodoDetail(id);
    const endTime = performance.now();
    const queryTime = endTime - startTime;

    console.log(`⏱️  Query time: ${queryTime.toFixed(2)}ms`);
    console.log('');

    return result.result;
}

/**
 * Fetch TODO using rawsql-ts
 */
async function fetchTodoWithRawSql(id: number): Promise<any> {
    console.log('⚡ Querying with rawsql-ts...');
    console.log('');

    const startTime = performance.now();
    const result = await rawSqlService.getTodoDetail(id);
    const endTime = performance.now();
    const queryTime = endTime - startTime;

    console.log(`⏱️  Query time: ${queryTime.toFixed(2)}ms`);
    console.log('');

    return result.result;
}

/**
 * Display TODO result in a formatted way
 */
function displayTodoResult(todo: any, method: string): void {
    if (!todo) {
        console.log('❌ TODO not found');
        console.log('');
        return;
    }

    console.log(`✅ TODO found using ${method}:`);
    console.log('='.repeat(50));

    console.log(`📝 Title: ${todo.title}`);
    console.log(`📄 Description: ${todo.description}`);
    console.log(`✅ Completed: ${todo.completed ? 'Yes' : 'No'}`);

    // User information
    const user = todo.user;
    if (user) {
        console.log(`👤 User: ${user.userName} (${user.email})`);
        if (user.createdAt) {
            console.log(`📅 User since: ${new Date(user.createdAt).toLocaleDateString()}`);
        }
    }

    // Category information
    const category = todo.category;
    if (category) {
        console.log(`🏷️  Category: ${category.categoryName} (${category.color})`);
    }

    // Creation date
    if (todo.createdAt) {
        console.log(`📅 Created: ${new Date(todo.createdAt).toLocaleString()}`);
    }

    // Comments
    const comments = todo.comments || [];
    if (comments.length > 0) {
        console.log(`💬 Comments (${comments.length}):`);
        comments.forEach((comment: any, index: number) => {
            const commentUser = comment.user;
            const commentText = comment.commentText;
            const commentCreatedAt = comment.createdAt;

            if (commentText) {
                console.log(`   ${index + 1}. ${commentUser ? commentUser.userName : 'Unknown'}: "${commentText}"`);
                if (commentCreatedAt) {
                    console.log(`      📅 ${new Date(commentCreatedAt).toLocaleString()}`);
                }
            }
        });
    } else {
        console.log(`💬 Comments: None`);
    }

    console.log('='.repeat(50));
    console.log('');
}

/**
 * Ask user if they want to continue
 */
function promptContinue(): Promise<boolean> {
    return new Promise((resolve) => {
        rl.question('🔄 Do you want to try another query? (y/n): ', (answer) => {
            const choice = answer.trim().toLowerCase();
            if (choice === 'y' || choice === 'yes') {
                resolve(true);
            } else if (choice === 'n' || choice === 'no') {
                resolve(false);
            } else {
                console.log('❌ Please enter y/yes or n/no.');
                console.log('');
                resolve(promptContinue());
            }
        });
    });
}

/**
 * Display available TODOs for reference
 */
async function displayAvailableTodos(): Promise<void> {
    try {
        console.log('📋 Available TODOs for testing:');
        console.log('-'.repeat(30));

        const todos = await prisma.todo.findMany({
            select: {
                todo_id: true,
                title: true,
                completed: true
            },
            orderBy: {
                todo_id: 'asc'
            }
        });

        todos.forEach((todo: any) => {
            const status = todo.completed ? '✅' : '⭕';
            console.log(`${status} ID: ${todo.todo_id} - ${todo.title}`);
        });

        console.log('-'.repeat(30));
        console.log('');
    } catch (error) {
        console.log('⚠️  Could not load available TODOs');
        console.log('');
    }
}

/**
 * Main application loop
 */
async function main(): Promise<void> {
    try {
        // Test database connection
        await prisma.$connect();
        console.log('🔌 Database connected successfully');
        console.log('');

        let continueRunning = true;

        while (continueRunning) {
            displayHeader();

            // Show available TODOs for reference
            await displayAvailableTodos();

            // Get user preferences
            const method = await promptQueryMethod();
            const todoId = await promptTodoId();

            console.log('');

            try {
                let result;

                if (method === 'prisma') {
                    result = await fetchTodoWithPrisma(todoId);
                    displayTodoResult(result, 'Prisma ORM');
                } else {
                    result = await fetchTodoWithRawSql(todoId);
                    displayTodoResult(result, 'rawsql-ts');
                }

            } catch (error) {
                console.log('❌ Error occurred while querying:');
                console.log(error instanceof Error ? error.message : String(error));
                console.log('');
            }

            // Ask if user wants to continue
            continueRunning = await promptContinue();
            console.log('');
        }

        console.log('👋 Thanks for using the demo! Goodbye!');

    } catch (error) {
        console.error('❌ Application error:', error);
    } finally {
        // Cleanup
        await prisma.$disconnect();
        rl.close();
    }
}

// Handle process termination gracefully
process.on('SIGINT', async () => {
    console.log('\n👋 Shutting down gracefully...');
    await prisma.$disconnect();
    rl.close();
    process.exit(0);
});

// Run the application
if (require.main === module) {
    main().catch(console.error);
}

export { main };
