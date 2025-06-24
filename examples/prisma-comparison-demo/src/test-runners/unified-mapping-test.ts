/**
 * Enhanced test to verify the unified JSON mapping system and validate type safety
 */

import { JsonMapping, TypeProtectionConfig } from '../../../../packages/prisma-integration/src';
import { JsonMappingConverter } from '../../../../packages/core/src';
import * as fs from 'fs';
import * as path from 'path';

interface StringFieldValidation {
    fieldName: string;
    columnName: string;
    entityName: string;
    hasStringType: boolean;
    severity: 'warning' | 'error';
    recommendation: string;
}

async function validateStringFields(unifiedMapping: any): Promise<StringFieldValidation[]> {
    const issues: StringFieldValidation[] = [];

    // Known string fields from Prisma schema
    const knownStringFields = new Set([
        'title', 'description', 'user_name', 'email',
        'category_name', 'color', 'comment_text'
    ]);

    // Helper function to check columns in an entity
    const checkEntityColumns = (entityName: string, columns: Record<string, any>) => {
        for (const [fieldName, config] of Object.entries(columns)) {
            const columnName = typeof config === 'string' ? config : config.column;
            const hasStringType = typeof config === 'object' && config.type === 'string';

            // Check if this column maps to a known string field in the database
            if (knownStringFields.has(columnName)) {
                if (!hasStringType) {
                    issues.push({
                        fieldName,
                        columnName,
                        entityName,
                        hasStringType: false,
                        severity: 'warning',
                        recommendation: `Add "type": "string" to protect against SQL injection and ensure type safety`
                    });
                }
            }
        }
    };

    // Check root entity
    checkEntityColumns(unifiedMapping.rootEntity.name, unifiedMapping.rootEntity.columns);

    // Check nested entities
    if (unifiedMapping.nestedEntities) {
        for (const entity of unifiedMapping.nestedEntities) {
            checkEntityColumns(entity.name, entity.columns);
        }
    }

    return issues;
}

async function testUnifiedMapping() {
    console.log('🔍 Testing Unified JSON Mapping System');
    console.log('='.repeat(50));

    try {
        // Load the unified getTodoDetail.json mapping
        const mappingPath = path.join(__dirname, '../../rawsql-ts/getTodoDetail.json');
        const content = fs.readFileSync(mappingPath, 'utf8');
        const unifiedMapping = JSON.parse(content);

        console.log('✅ Loaded unified mapping file');
        console.log('📋 Root entity columns:', Object.keys(unifiedMapping.rootEntity.columns));

        // 🔒 NEW: Validate string field protection
        console.log('\n🔍 Validating String Field Protection...');
        const validationIssues = await validateStringFields(unifiedMapping);

        if (validationIssues.length > 0) {
            console.log('⚠️  String Field Protection Issues Found:');
            console.log('-'.repeat(60));

            for (const issue of validationIssues) {
                const icon = issue.severity === 'warning' ? '⚠️' : '❌';
                console.log(`${icon} ${issue.severity.toUpperCase()}: ${issue.entityName}.${issue.fieldName}`);
                console.log(`   📊 Database Column: ${issue.columnName}`);
                console.log(`   🔒 String Type Protection: ${issue.hasStringType ? 'YES' : 'NO'}`);
                console.log(`   💡 Recommendation: ${issue.recommendation}`);
                console.log(`   🛠️  Fix: In your JSON mapping, change:`);
                console.log(`      "${issue.fieldName}": "${issue.columnName}"`);
                console.log(`      to:`);
                console.log(`      "${issue.fieldName}": { "column": "${issue.columnName}", "type": "string" }`);
                console.log('');
            }

            console.log('🚨 Why this matters:');
            console.log('   • String fields without type protection are vulnerable to SQL injection');
            console.log('   • Type coercion issues can occur when database returns non-string values');
            console.log('   • type: "string" ensures values are always converted to strings for safety');
            console.log('');
        } else {
            console.log('✅ All string fields are properly protected!');
        }

        // Convert to separate JsonMapping and TypeProtection using new API
        const converter = new JsonMappingConverter();
        const result = converter.convert(unifiedMapping);
        const jsonMapping = result.mapping;
        const typeProtection = result.typeProtection;

        console.log('\n🔄 Conversion Results:');
        console.log('📋 JsonMapping root columns:', Object.keys(jsonMapping.rootEntity.columns));
        console.log('🔒 Protected string fields:', typeProtection.protectedStringFields);

        // Verify that string type columns are properly converted
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

        // Final summary
        if (validationIssues.length === 0) {
            console.log('🎯 Security Status: EXCELLENT - All string fields are protected');
        } else {
            console.log(`🎯 Security Status: NEEDS ATTENTION - ${validationIssues.length} protection issue(s) found`);
        }

    } catch (error) {
        console.error('❌ Test failed:', error);
    }
}

testUnifiedMapping();
