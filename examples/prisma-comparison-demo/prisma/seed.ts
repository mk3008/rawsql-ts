import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
    console.log('🌱 Starting seed...')

    // Clean existing data
    await prisma.todoComment.deleteMany()
    await prisma.todo.deleteMany()
    await prisma.user.deleteMany()
    await prisma.category.deleteMany()

    // Reset sequences to ensure consistent IDs
    await prisma.$executeRaw`ALTER SEQUENCE user_user_id_seq RESTART WITH 1;`
    await prisma.$executeRaw`ALTER SEQUENCE category_category_id_seq RESTART WITH 1;`
    await prisma.$executeRaw`ALTER SEQUENCE todo_todo_id_seq RESTART WITH 1;`
    await prisma.$executeRaw`ALTER SEQUENCE todo_comment_comment_id_seq RESTART WITH 1;`

    // Create users with fixed IDs
    const users = await Promise.all([
        prisma.user.create({
            data: {
                user_id: 1,
                user_name: 'Alice Johnson',
                email: 'alice@example.com',
            },
        }),
        prisma.user.create({
            data: {
                user_id: 2,
                user_name: 'Bob Smith',
                email: 'bob@example.com',
            },
        }),
        prisma.user.create({
            data: {
                user_id: 3,
                user_name: 'Charlie Brown',
                email: 'charlie@example.com',
            },
        }),
        prisma.user.create({
            data: {
                user_id: 4,
                user_name: 'Diana Wilson',
                email: 'diana@example.com',
            },
        }),
    ])    // Create categories with fixed IDs
    const categories = await Promise.all([
        prisma.category.create({
            data: {
                category_id: 1,
                category_name: 'Work',
                color: '#3b82f6', // blue
            },
        }),
        prisma.category.create({
            data: {
                category_id: 2,
                category_name: 'Personal',
                color: '#10b981', // green
            },
        }),
        prisma.category.create({
            data: {
                category_id: 3,
                category_name: 'Shopping',
                color: '#f59e0b', // yellow
            },
        }),
        prisma.category.create({
            data: {
                category_id: 4,
                category_name: 'Health',
                color: '#ef4444', // red
            },
        }),
        prisma.category.create({
            data: {
                category_id: 5,
                category_name: 'Learning',
                color: '#8b5cf6', // purple
            },
        }),
    ])    // Create todos with fixed IDs
    const todos = await Promise.all([
        // Alice's todos
        prisma.todo.create({
            data: {
                todo_id: 1,
                title: 'Complete project proposal',
                description: 'Write the Q2 project proposal for the new client',
                completed: false,
                user_id: 1, // Alice
                category_id: 1, // Work
            },
        }),
        prisma.todo.create({
            data: {
                todo_id: 2,
                title: 'Buy groceries',
                description: 'Milk, eggs, bread, and vegetables',
                completed: true,
                user_id: 1, // Alice
                category_id: 3, // Shopping
            },
        }),
        prisma.todo.create({
            data: {
                todo_id: 3,
                title: 'Morning workout',
                description: '30 minutes cardio and strength training',
                completed: true,
                user_id: 1, // Alice
                category_id: 4, // Health
            },
        }),

        // Bob's todos
        prisma.todo.create({
            data: {
                todo_id: 4,
                title: 'Code review for feature X',
                description: 'Review pull requests for the authentication feature',
                completed: false,
                user_id: 2, // Bob
                category_id: 1, // Work
            },
        }),
        prisma.todo.create({
            data: {
                todo_id: 5,
                title: 'Learn TypeScript advanced features',
                description: 'Study generics, utility types, and conditional types',
                completed: false,
                user_id: 2, // Bob
                category_id: 5, // Learning
            },
        }),

        // Charlie's todos
        prisma.todo.create({
            data: {
                todo_id: 6,
                title: 'Plan weekend trip',
                description: 'Research hotels and activities for the mountain trip',
                completed: false,
                user_id: 3, // Charlie
                category_id: 2, // Personal
            },
        }),
        prisma.todo.create({
            data: {
                todo_id: 7,
                title: 'Fix kitchen sink',
                description: 'Replace the leaky faucet in the kitchen',
                completed: false,
                user_id: 3, // Charlie
                category_id: 2, // Personal
            },
        }),

        // Diana's todos
        prisma.todo.create({
            data: {
                todo_id: 8,
                title: 'Prepare presentation slides',
                description: 'Create slides for the quarterly business review',
                completed: true,
                user_id: 4, // Diana
                category_id: 1, // Work
            },
        }),
        prisma.todo.create({
            data: {
                todo_id: 9,
                title: 'Buy birthday gift',
                description: 'Find a nice gift for mom\'s birthday next week',
                completed: false,
                user_id: 4, // Diana
                category_id: 3, // Shopping
            },
        }),
        prisma.todo.create({
            data: {
                todo_id: 10,
                title: 'Annual health checkup',
                description: 'Schedule and complete annual medical examination',
                completed: false,
                user_id: 4, // Diana
                category_id: 4, // Health
            },
        }),
    ])    // Create comments for todos
    const comments = [
        // Comments for "Complete project proposal" (todo_id: 1)
        {
            comment_text: 'Started working on the outline, looking good so far!',
            todo_id: 1,
            user_id: 1, // Alice commenting on her own todo
        },
        {
            comment_text: 'Let me know if you need help with the technical sections.',
            todo_id: 1,
            user_id: 2, // Bob helping Alice
        },
        {
            comment_text: 'The deadline is next Friday, just a reminder.',
            todo_id: 1,
            user_id: 4, // Diana reminding Alice
        },

        // Comments for "Code review for feature X" (todo_id: 4)
        {
            comment_text: 'Found a few minor issues, but overall looks great!',
            todo_id: 4,
            user_id: 2, // Bob commenting on his own todo
        },
        {
            comment_text: 'The authentication logic seems solid. Nice work!',
            todo_id: 4,
            user_id: 1, // Alice praising Bob
        },

        // Comments for "Learn TypeScript advanced features" (todo_id: 5)
        {
            comment_text: 'I recommend checking out the official TypeScript handbook.',
            todo_id: 5,
            user_id: 1, // Alice giving advice to Bob
        },
        {
            comment_text: 'There\'s a great course on advanced TypeScript patterns.',
            todo_id: 5,
            user_id: 3, // Charlie sharing resources
        },
        {
            comment_text: 'Thanks for the suggestions! Will check them out.',
            todo_id: 5,
            user_id: 2, // Bob thanking others
        },

        // Comments for "Plan weekend trip" (todo_id: 6)
        {
            comment_text: 'I went to that area last year, happy to share recommendations!',
            todo_id: 6,
            user_id: 4, // Diana helping Charlie
        },

        // Comments for "Buy birthday gift" (todo_id: 9)
        {
            comment_text: 'What kind of things does she like? Maybe I can suggest something.',
            todo_id: 9,
            user_id: 3, // Charlie asking Diana
        },
        {
            comment_text: 'She loves gardening and reading mystery novels.',
            todo_id: 9,
            user_id: 4, // Diana responding
        },
        {
            comment_text: 'Perfect! I saw a great gardening book set at the bookstore.',
            todo_id: 9,
            user_id: 3, // Charlie suggesting
        },
    ]

    await Promise.all(
        comments.map(comment =>
            prisma.todoComment.create({
                data: comment,
            })
        )
    )

    console.log('✅ Seed completed successfully!')
    console.log(`📊 Created:`)
    console.log(`   - ${users.length} users`)
    console.log(`   - ${categories.length} categories`)
    console.log(`   - ${todos.length} todos`)
    console.log(`   - ${comments.length} comments`)
}

main()
    .catch((e) => {
        console.error('❌ Seed failed:', e)
        process.exit(1)
    })
    .finally(async () => {
        await prisma.$disconnect()
    })
