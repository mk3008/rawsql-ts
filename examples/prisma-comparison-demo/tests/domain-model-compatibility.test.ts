/**
 * Domain Model Compatibility Tests
 * Tests that verify JsonMapping configurations produce structures 
 * that are compatible with specific domain model interfaces.
 */

import { describe, it, expect } from 'vitest';
import { JsonMapping, JsonSchemaValidator } from '../../../packages/core/src';
import { TodoDetail } from '../src/contracts';
import * as fs from 'fs';
import * as path from 'path';

describe('Domain Model Compatibility Tests', () => {
    describe('TodoDetail Service', () => {
        it('should have getTodoDetail JsonMapping compatible with TodoDetail type structure', async () => {
            // Test: JsonMapping ↔ Domain Model compatibility validation
            // Ensures file-based JsonMapping produces structure matching TodoDetail interface
            // Note: Basic SQL ↔ JsonMapping compatibility is tested by sql-static-analysis.test.ts

            const todoDetailSample: TodoDetail = {
                todoId: 1,
                title: "Sample Todo",
                description: "Sample Description",
                completed: false,
                createdAt: new Date(),
                updatedAt: new Date(),
                user: {
                    userId: 1,
                    userName: "Sample User",
                    email: "sample@example.com",
                    createdAt: new Date()
                },
                category: {
                    categoryId: 1,
                    categoryName: "Sample Category",
                    color: "blue",
                    createdAt: new Date()
                },
                comments: [{
                    commentId: 1,
                    commentText: "Sample Comment",
                    createdAt: new Date(),
                    user: {
                        userId: 2,
                        userName: "Comment User",
                        email: "comment@example.com"
                    }
                }]
            };

            // Load the JsonMapping from the file (simulate the same process as PrismaReader)
            const jsonMappingPath = path.join('./rawsql-ts', 'getTodoDetail.json');
            const jsonMappingContent = fs.readFileSync(jsonMappingPath, 'utf8');
            const jsonMapping: JsonMapping = JSON.parse(jsonMappingContent);

            const validationResult = JsonSchemaValidator.validateAgainstSample(jsonMapping, todoDetailSample);

            expect(validationResult.isValid).toBe(true);
            expect(validationResult.errors).toHaveLength(0);
            expect(validationResult.missingProperties).toHaveLength(0);
        });
    });
});
