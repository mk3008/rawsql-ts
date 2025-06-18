/**
 * Test script to demonstrate the enhanced validation system with unsafe mapping
 */

import { convertUnifiedMapping, UnifiedJsonMapping, ColumnMappingConfig } from '../../../../packages/prisma-integration/src';
import * as fs from 'fs';
import * as path from 'path';

interface StringFieldValidation {
    fieldName: string;
    columnName: string;
    entityName: string;
    hasForceString: boolean;
    severity: 'warning' | 'error';
    recommendation: string;
}

async function validateStringFields(
    unifiedMapping: UnifiedJsonMapping,
    severity: 'warning' | 'error' = 'error'
): Promise<StringFieldValidation[]> {
    const issues: StringFieldValidation[] = [];

    // Known string fields from Prisma schema
    const knownStringFields = new Set([
        'title', 'description', 'user_name', 'email',
        'category_name', 'color', 'comment_text'
    ]);

    // Helper function to check columns in an entity
    const checkEntityColumns = (entityName: string, columns: Record<string, ColumnMappingConfig>) => {
        for (const [fieldName, config] of Object.entries(columns)) {
            const columnName = typeof config === 'string' ? config : config.column;
            const hasForceString = typeof config === 'object' && config.forceString === true;

            // Check if this column maps to a known string field in the database
            if (knownStringFields.has(columnName)) {
                if (!hasForceString) {
                    issues.push({
                        fieldName,
                        columnName,
                        entityName,
                        hasForceString: false,
                        severity: severity,
                        recommendation: `Add "forceString": true to ensure proper string type conversion and prevent type coercion issues`
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

async function testUnsafeMapping() {
    console.log('🔍 Testing Enhanced Validation with Unsafe Mapping');
    console.log('='.repeat(60));

    try {
        // Load the unsafe getTodoDetail.json mapping
        const mappingPath = path.join(__dirname, '../../rawsql-ts/getTodoDetail-unsafe.json');
        const content = fs.readFileSync(mappingPath, 'utf8');
        const unifiedMapping = JSON.parse(content);

        console.log('✅ Loaded unsafe mapping file for demonstration');
        console.log('📋 This file intentionally has security issues to demonstrate validation');        // 🔒 Validate string field protection (default: error level)
        console.log('\n🔍 Validating String Field Protection...');
        const validationIssues = await validateStringFields(unifiedMapping, 'error');

        if (validationIssues.length > 0) {
            console.log('⚠️  String Field Protection Issues Found:');
            console.log('-'.repeat(60));

            for (const issue of validationIssues) {
                const icon = issue.severity === 'warning' ? '⚠️' : '❌';
                console.log(`${icon} ${issue.severity.toUpperCase()}: ${issue.entityName}.${issue.fieldName}`);
                console.log(`   📊 Database Column: ${issue.columnName}`);
                console.log(`   🔒 Force String Protection: ${issue.hasForceString ? 'YES' : 'NO'}`);
                console.log(`   💡 Recommendation: ${issue.recommendation}`);
                console.log(`   🛠️  Fix: In your JSON mapping, change:`);
                console.log(`      "${issue.fieldName}": "${issue.columnName}"`);
                console.log(`      to:`);
                console.log(`      "${issue.fieldName}": { "column": "${issue.columnName}", "forceString": true }`);
                console.log('');
            } console.log('🚨 Why this matters:');
            console.log('   • String fields may be returned as incorrect types (date, bigint, etc.) from database');
            console.log('   • Runtime errors can occur when JavaScript expects string methods on non-string values');
            console.log('   • forceString ensures values are always converted to strings for safety');
            console.log('   • This is especially important for user-generated content fields');
            console.log('');

            console.log('🔧 How to fix these issues:');
            console.log('   1. Add forceString: true to all string fields that contain user data');
            console.log('   2. Pay special attention to fields like: title, description, names, emails');
            console.log('   3. Run this validation test regularly during development');
            console.log('   4. Consider adding this validation to your CI/CD pipeline');
            console.log('');
        } else {
            console.log('✅ All string fields are properly protected!');
        }

        console.log('\n🎉 Enhanced Validation Test Completed!');

        // Final summary
        if (validationIssues.length === 0) {
            console.log('🎯 Security Status: EXCELLENT - All string fields are protected');
        } else {
            console.log(`🎯 Security Status: NEEDS ATTENTION - ${validationIssues.length} protection issue(s) found`);
            console.log('🚀 Next steps: Fix the issues above and re-run this test');
        }

    } catch (error) {
        console.error('❌ Test failed:', error);
    }
}

testUnsafeMapping();
