/**
 * Simple test to verify the unified JSON mapping system works correctly
 */

import { convertUnifiedMapping } from '../../../../packages/prisma-integration/src';
import * as fs from 'fs';
import * as path from 'path';

async function testUnifiedMapping() {
    console.log('🔍 Testing Unified JSON Mapping System');
    console.log('='.repeat(50));

    try {        // Load the unified getTodoDetail.json mapping
        const mappingPath = path.join(__dirname, '../../rawsql-ts/getTodoDetail.json');
        const content = fs.readFileSync(mappingPath, 'utf8');
        const unifiedMapping = JSON.parse(content);

        console.log('✅ Loaded unified mapping file');
        console.log('📋 Root entity columns:', Object.keys(unifiedMapping.rootEntity.columns));

        // Convert to separate JsonMapping and TypeProtection
        const { jsonMapping, typeProtection } = convertUnifiedMapping(unifiedMapping);

        console.log('\n🔄 Conversion Results:');
        console.log('📋 JsonMapping root columns:', Object.keys(jsonMapping.rootEntity.columns));
        console.log('🔒 Protected string fields:', typeProtection.protectedStringFields);

        // Verify that forceString columns are properly converted
        const expectedProtectedFields = [
            'title', 'description', 'user_name', 'email',
            'category_name', 'color', 'comment_text',
            'comment_user_name', 'comment_user_email'
        ];

        const allFieldsProtected = expectedProtectedFields.every(field =>
            typeProtection.protectedStringFields.includes(field)
        );

        if (allFieldsProtected) {
            console.log('✅ All expected fields are protected');
        } else {
            console.log('❌ Some expected fields are missing from protection');
            console.log('Expected:', expectedProtectedFields);
            console.log('Actual:', typeProtection.protectedStringFields);
        }

        // Verify that regular columns are converted correctly
        const rootColumns = jsonMapping.rootEntity.columns;
        const hasRegularColumns = rootColumns.todoId === 'todo_id' &&
            rootColumns.completed === 'completed';

        if (hasRegularColumns) {
            console.log('✅ Regular columns converted correctly');
        } else {
            console.log('❌ Regular columns conversion failed');
        }

        console.log('\n🎉 Unified JSON Mapping Test Completed!');

    } catch (error) {
        console.error('❌ Test failed:', error);
    }
}

testUnifiedMapping();
