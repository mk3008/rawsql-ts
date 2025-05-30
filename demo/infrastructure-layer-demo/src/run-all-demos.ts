import { runMigrationDemo } from './migrated-schema-demo';
import { runSchemaFeaturesDemo } from './schema-features-demo';
import { runAdvancedFindByIdDemo } from './findById-advanced-demo';

/**
 * Demo Suite Runner
 * Executes all separated demos in logical order
 */

async function runAllDemos() {
    console.log('🎪 rawsql-ts Infrastructure Layer Demo Suite');
    console.log('==============================================\n');

    console.log('📋 Demo Execution Plan:');
    console.log('   1️⃣ Migration Verification - Confirm library migration success');
    console.log('   2️⃣ Schema Features - Comprehensive schema functionality testing');
    console.log('   3️⃣ Advanced Queries - Complex database operations and edge cases');
    console.log();

    const readline = require('readline');
    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout
    });

    const question = (text: string): Promise<string> => {
        return new Promise(resolve => {
            rl.question(text, resolve);
        });
    };

    try {
        // Demo 1: Migration Verification
        console.log('🔄 Running Demo 1: Migration Verification');
        console.log('─'.repeat(50));
        await runMigrationDemo();

        const continueToDemo2 = await question('\n⏩ Continue to Demo 2? (y/n): ');
        if (continueToDemo2.toLowerCase() !== 'y') {
            console.log('Demo suite stopped by user.');
            rl.close();
            return;
        }

        console.log('\n'.repeat(3));

        // Demo 2: Schema Features
        console.log('🛠️ Running Demo 2: Schema Features');
        console.log('─'.repeat(50));
        await runSchemaFeaturesDemo();

        const continueToDemo3 = await question('\n⏩ Continue to Demo 3? (y/n): ');
        if (continueToDemo3.toLowerCase() !== 'y') {
            console.log('Demo suite stopped by user.');
            rl.close();
            return;
        }

        console.log('\n'.repeat(3));

        // Demo 3: Advanced Queries (requires database)
        console.log('🚀 Running Demo 3: Advanced Queries');
        console.log('─'.repeat(50));
        console.log('⚠️  Note: This demo requires Docker database connection');

        const runDatabaseDemo = await question('📍 Run database demo? (y/n): ');
        if (runDatabaseDemo.toLowerCase() === 'y') {
            await runAdvancedFindByIdDemo();
        } else {
            console.log('Database demo skipped. Start with: docker-compose up -d');
        }

        console.log('\n🎉 All Demos Complete!');
        console.log('\n📊 Summary:');
        console.log('   ✅ Migration verification completed');
        console.log('   ✅ Schema features demonstrated');
        console.log(`   ${runDatabaseDemo.toLowerCase() === 'y' ? '✅' : '⏭️'} Advanced queries ${runDatabaseDemo.toLowerCase() === 'y' ? 'executed' : 'skipped'}`);

        console.log('\n💡 Next Steps:');
        console.log('   • Review individual demo files for detailed implementation');
        console.log('   • Explore src/ directory for infrastructure patterns');
        console.log('   • Check integration with your own database schema');

    } catch (error) {
        console.error('\n❌ Demo suite error:', error);
    } finally {
        rl.close();
    }
}

// Individual demo execution options
async function runSpecificDemo(demoName: string) {
    switch (demoName) {
        case 'migration':
            await runMigrationDemo();
            break;
        case 'schema':
            await runSchemaFeaturesDemo();
            break;
        case 'queries':
            await runAdvancedFindByIdDemo();
            break;
        default:
            console.log('Available demos: migration, schema, queries');
            console.log('Or run without arguments for interactive suite');
    }
}

// Main execution logic
if (require.main === module) {
    const demoArg = process.argv[2];

    if (demoArg) {
        runSpecificDemo(demoArg).catch(console.error);
    } else {
        runAllDemos().catch(console.error);
    }
}

export { runAllDemos, runSpecificDemo };
