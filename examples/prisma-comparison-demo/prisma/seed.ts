import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
    console.log('🌱 Starting seed...')

    // Clean existing data
    await prisma.todoComment.deleteMany()
    await prisma.todo.deleteMany()
    await prisma.user.deleteMany()
    await prisma.category.deleteMany()

    // Create users
    const users = await Promise.all([
        prisma.user.create({
            data: {
                user_name: 'Alice Johnson',
                email: 'alice@example.com',
            },
        }),
        prisma.user.create({
            data: {
                user_name: 'Bob Smith',
                email: 'bob@example.com',
            },
        }),
        prisma.user.create({
            data: {
                user_name: 'Charlie Brown',
                email: 'charlie@example.com',
            },
        }),
        prisma.user.create({
            data: {
                user_name: 'Diana Wilson',
                email: 'diana@example.com',
            },
        }),
    ])

    // Create categories
    const categories = await Promise.all([
        prisma.category.create({
            data: {
                category_name: 'Work',
                color: '#3b82f6', // blue
            },
        }),
        prisma.category.create({
            data: {
                category_name: 'Personal',
                color: '#10b981', // green
            },
        }),
        prisma.category.create({
            data: {
                category_name: 'Shopping',
                color: '#f59e0b', // yellow
            },
        }),
        prisma.category.create({
            data: {
                category_name: 'Health',
                color: '#ef4444', // red
            },
        }),
        prisma.category.create({
            data: {
                category_name: 'Learning',
                color: '#8b5cf6', // purple
            },
        }),
    ])

    // Create todos
    const todos = await Promise.all([
        // Alice's todos
        prisma.todo.create({
            data: {
                title: 'Complete project proposal',
                description: 'Write the Q2 project proposal for the new client',
                completed: false,
                user_id: users[0].user_id,
                category_id: categories[0].category_id, // Work
            },
        }),
        prisma.todo.create({
            data: {
                title: 'Buy groceries',
                description: 'Milk, eggs, bread, and vegetables',
                completed: true,
                user_id: users[0].user_id,
                category_id: categories[2].category_id, // Shopping
            },
        }),
        prisma.todo.create({
            data: {
                title: 'Morning workout',
                description: '30 minutes cardio and strength training',
                completed: true,
                user_id: users[0].user_id,
                category_id: categories[3].category_id, // Health
            },
        }),

        // Bob's todos
        prisma.todo.create({
            data: {
                title: 'Code review for feature X',
                description: 'Review pull requests for the authentication feature',
                completed: false,
                user_id: users[1].user_id,
                category_id: categories[0].category_id, // Work
            },
        }),
        prisma.todo.create({
            data: {
                title: 'Learn TypeScript advanced features',
                description: 'Study generics, utility types, and conditional types',
                completed: false,
                user_id: users[1].user_id,
                category_id: categories[4].category_id, // Learning
            },
        }),

        // Charlie's todos
        prisma.todo.create({
            data: {
                title: 'Plan weekend trip',
                description: 'Research hotels and activities for the mountain trip',
                completed: false,
                user_id: users[2].user_id,
                category_id: categories[1].category_id, // Personal
            },
        }),
        prisma.todo.create({
            data: {
                title: 'Fix kitchen sink',
                description: 'Replace the leaky faucet in the kitchen',
                completed: false,
                user_id: users[2].user_id,
                category_id: categories[1].category_id, // Personal
            },
        }),

        // Diana's todos
        prisma.todo.create({
            data: {
                title: 'Prepare presentation slides',
                description: 'Create slides for the quarterly business review',
                completed: true,
                user_id: users[3].user_id,
                category_id: categories[0].category_id, // Work
            },
        }),
        prisma.todo.create({
            data: {
                title: 'Buy birthday gift',
                description: 'Find a nice gift for mom\'s birthday next week',
                completed: false,
                user_id: users[3].user_id,
                category_id: categories[2].category_id, // Shopping
            },
        }),
        prisma.todo.create({
            data: {
                title: 'Annual health checkup',
                description: 'Schedule and complete annual medical examination',
                completed: false,
                user_id: users[3].user_id,
                category_id: categories[3].category_id, // Health
            },
        }),
    ])

    // Create comments for todos
    const comments = [
        // Comments for "Complete project proposal" (todos[0])
        {
            comment_text: 'Started working on the outline, looking good so far!',
            todo_id: todos[0].todo_id,
            user_id: users[0].user_id, // Alice commenting on her own todo
        },
        {
            comment_text: 'Let me know if you need help with the technical sections.',
            todo_id: todos[0].todo_id,
            user_id: users[1].user_id, // Bob helping Alice
        },
        {
            comment_text: 'The deadline is next Friday, just a reminder.',
            todo_id: todos[0].todo_id,
            user_id: users[3].user_id, // Diana reminding Alice
        },

        // Comments for "Code review for feature X" (todos[3])
        {
            comment_text: 'Found a few minor issues, but overall looks great!',
            todo_id: todos[3].todo_id,
            user_id: users[1].user_id, // Bob commenting on his own todo
        },
        {
            comment_text: 'The authentication logic seems solid. Nice work!',
            todo_id: todos[3].todo_id,
            user_id: users[0].user_id, // Alice praising Bob
        },

        // Comments for "Learn TypeScript advanced features" (todos[4])
        {
            comment_text: 'I recommend checking out the official TypeScript handbook.',
            todo_id: todos[4].todo_id,
            user_id: users[0].user_id, // Alice giving advice to Bob
        },
        {
            comment_text: 'There\'s a great course on advanced TypeScript patterns.',
            todo_id: todos[4].todo_id,
            user_id: users[2].user_id, // Charlie sharing resources
        },
        {
            comment_text: 'Thanks for the suggestions! Will check them out.',
            todo_id: todos[4].todo_id,
            user_id: users[1].user_id, // Bob thanking others
        },

        // Comments for "Plan weekend trip" (todos[5])
        {
            comment_text: 'I went to that area last year, happy to share recommendations!',
            todo_id: todos[5].todo_id,
            user_id: users[3].user_id, // Diana helping Charlie
        },

        // Comments for "Buy birthday gift" (todos[8])
        {
            comment_text: 'What kind of things does she like? Maybe I can suggest something.',
            todo_id: todos[8].todo_id,
            user_id: users[2].user_id, // Charlie asking Diana
        },
        {
            comment_text: 'She loves gardening and reading mystery novels.',
            todo_id: todos[8].todo_id,
            user_id: users[3].user_id, // Diana responding
        },
        {
            comment_text: 'Perfect! I saw a great gardening book set at the bookstore.',
            todo_id: todos[8].todo_id,
            user_id: users[2].user_id, // Charlie suggesting
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
