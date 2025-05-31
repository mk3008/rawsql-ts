/**
 * Prisma Database Seeder
 * Populate the database with sample data for testing and demos
 */

// Note: This file requires Prisma to be properly installed
// Run: npm install && npm run prisma:generate

async function seedDatabase() {
    console.log('🌱 Seeding database with sample data...');

    try {
        // This is a placeholder - actual seeding would require installed Prisma
        console.log('📝 Note: Install Prisma and run the following commands:');
        console.log('   npm install @prisma/client prisma');
        console.log('   npm run prisma:generate');
        console.log('   npm run prisma:push');
        console.log('   npm run prisma:seed');

        console.log('\n🗂️ Sample data to be seeded:');
        console.log('Categories:');
        console.log('  - Work (blue)');
        console.log('  - Personal (green)');
        console.log('  - Shopping (orange)');

        console.log('\nTodos:');
        console.log('  - "Complete project documentation" (Work, high priority)');
        console.log('  - "Buy groceries" (Personal, medium priority)');
        console.log('  - "Review code changes" (Work, high priority)');

        console.log('\nComments:');
        console.log('  - Various comments attached to todos');

    } catch (error) {
        console.error('❌ Seeding error:', error);
        throw error;
    }
}

// Sample seeding code structure (for when Prisma is installed):
/*
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    // Create categories
    const workCategory = await prisma.category.create({
        data: {
            name: 'Work',
            description: 'Work-related tasks',
            color: '#3B82F6'
        }
    });

    const personalCategory = await prisma.category.create({
        data: {
            name: 'Personal',
            description: 'Personal tasks and activities',
            color: '#10B981'
        }
    });

    // Create todos
    await prisma.todo.createMany({
        data: [
            {
                title: 'Complete project documentation',
                description: 'Write comprehensive documentation for the new feature',
                status: 'in_progress',
                priority: 'high',
                categoryId: workCategory.category_id
            },
            {
                title: 'Buy groceries',
                description: 'Weekly grocery shopping',
                status: 'pending',
                priority: 'medium',
                categoryId: personalCategory.category_id
            }
        ]
    });

    console.log('✅ Database seeded successfully');
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
*/

// Execute seeding
if (require.main === module) {
    seedDatabase().catch(console.error);
}

export { seedDatabase };
