import { describe, it, expect, beforeEach } from 'vitest';
import {
    TypeTransformationPostProcessor,
    TypeTransformationConfig,
    transformDatabaseResult,
    TypeTransformers
} from '../../src/transformers/TypeTransformationPostProcessor';

describe('TypeTransformationPostProcessor', () => {
    let processor: TypeTransformationPostProcessor;

    beforeEach(() => {
        processor = new TypeTransformationPostProcessor(
            TypeTransformationPostProcessor.createDefaultConfig()
        );
    });

    describe('Date transformations', () => {
        it('should convert date strings to Date objects', () => {
            const input = {
                id: 1,
                name: 'Test User',
                created_at: '2024-01-15T10:30:00Z',
                updated_at: '2024-01-15'
            };

            const result = processor.transformResult(input);

            expect(result.id).toBe(1);
            expect(result.name).toBe('Test User');
            expect(result.created_at).toBeInstanceOf(Date);
            expect(result.updated_at).toBeInstanceOf(Date);
            expect(result.created_at.getTime()).toBe(new Date('2024-01-15T10:30:00Z').getTime());
        });

        it('should handle null date values', () => {
            const input = {
                id: 1,
                created_at: null,
                updated_at: '2024-01-15T10:30:00Z'
            };

            const result = processor.transformResult(input);

            expect(result.created_at).toBeNull();
            expect(result.updated_at).toBeInstanceOf(Date);
        });

        it('should handle invalid date strings gracefully', () => {
            const input = {
                id: 1,
                created_at: 'invalid-date'
            };

            const result = processor.transformResult(input);

            expect(result.created_at).toBe('invalid-date'); // Should remain unchanged
        });
    });

    describe('BigInt transformations', () => {
        it('should convert large numbers to BigInt', () => {
            const input = {
                id: 1,
                user_id: '12345678901234567890', // String representation of large number
                amount: '999999999999999999999999' // Large number as string (typical database output)
            };

            const result = processor.transformResult(input);

            expect(result.id).toBe(1);
            expect(result.user_id).toBe(BigInt('12345678901234567890'));
            expect(typeof result.user_id).toBe('bigint');
            expect(result.amount).toBe(BigInt('999999999999999999999999'));
            expect(typeof result.amount).toBe('bigint');
        });

        it('should handle null BigInt values', () => {
            const input = {
                id: 1,
                user_id: null
            };

            const result = processor.transformResult(input);

            expect(result.user_id).toBeNull();
        });

        it('should handle invalid BigInt values gracefully', () => {
            const input = {
                id: 1,
                user_id: 'not-a-number'
            };

            const result = processor.transformResult(input);

            expect(result.user_id).toBe('not-a-number'); // Should remain unchanged
        });
    });

    describe('Nested object transformations', () => {
        it('should transform nested objects recursively', () => {
            const input = {
                user: {
                    id: 1,
                    created_at: '2024-01-15T10:30:00Z',
                    profile: {
                        user_id: '12345678901234567890',
                        updated_at: '2024-01-15'
                    }
                },
                orders: [
                    {
                        id: 1,
                        order_date: '2024-01-15T10:30:00Z',
                        total_amount: '999999999999999999'
                    }
                ]
            };

            const result = processor.transformResult(input);

            expect(result.user.created_at).toBeInstanceOf(Date);
            expect(result.user.profile.user_id).toBe(BigInt('12345678901234567890'));
            expect(result.user.profile.updated_at).toBeInstanceOf(Date);
            expect(result.orders[0].order_date).toBeInstanceOf(Date);
            expect(result.orders[0].total_amount).toBe(BigInt('999999999999999999'));
        });
    });

    describe('Array transformations', () => {
        it('should transform arrays of objects', () => {
            const input = [
                {
                    id: 1,
                    created_at: '2024-01-15T10:30:00Z',
                    user_id: '12345678901234567890'
                },
                {
                    id: 2,
                    created_at: '2024-01-16T10:30:00Z',
                    user_id: '98765432109876543210'
                }
            ];

            const result = processor.transformResult(input);

            expect(result).toHaveLength(2);
            expect(result[0].created_at).toBeInstanceOf(Date);
            expect(result[0].user_id).toBe(BigInt('12345678901234567890'));
            expect(result[1].created_at).toBeInstanceOf(Date);
            expect(result[1].user_id).toBe(BigInt('98765432109876543210'));
        });
    });

    describe('Custom transformations', () => {
        it('should apply custom column transformations', () => {
            const customConfig: TypeTransformationConfig = {
                columnTransformations: {
                    'special_field': {
                        sourceType: 'custom',
                        targetType: 'custom',
                        customTransformer: 'upperCase'
                    }
                },
                customTransformers: {
                    'upperCase': (value: string) => value.toUpperCase()
                }
            };

            const customProcessor = new TypeTransformationPostProcessor(customConfig);

            const input = {
                id: 1,
                special_field: 'hello world'
            };

            const result = customProcessor.transformResult(input);

            expect(result.special_field).toBe('HELLO WORLD');
        });
    });

    describe('Static helper functions', () => {
        it('should provide transformDatabaseResult convenience function', () => {
            const input = {
                id: 1,
                created_at: '2024-01-15T10:30:00Z',
                user_id: '12345678901234567890'
            };

            const result = transformDatabaseResult(input);

            expect(result.created_at).toBeInstanceOf(Date);
            expect(result.user_id).toBe(BigInt('12345678901234567890'));
        });

        it('should provide individual transformer functions', () => {
            expect(TypeTransformers.toDate('2024-01-15T10:30:00Z')).toBeInstanceOf(Date);
            expect(TypeTransformers.toDate(null)).toBeNull();
            expect(TypeTransformers.toDate('invalid')).toBeNull();

            expect(TypeTransformers.toBigInt('12345678901234567890')).toBe(BigInt('12345678901234567890'));
            expect(TypeTransformers.toBigInt(12345)).toBe(BigInt(12345));
            expect(TypeTransformers.toBigInt(null)).toBeNull();

            expect(TypeTransformers.toObject('{"key": "value"}')).toEqual({ key: 'value' });
            expect(TypeTransformers.toObject(null)).toBeNull();
            expect(TypeTransformers.toObject('invalid json')).toBeNull();
        });
    });

    describe('Edge cases', () => {
        it('should handle null and undefined inputs', () => {
            expect(processor.transformResult(null)).toBeNull();
            expect(processor.transformResult(undefined)).toBeUndefined();
        });

        it('should handle primitive values', () => {
            expect(processor.transformResult('string')).toBe('string');
            expect(processor.transformResult(123)).toBe(123);
            expect(processor.transformResult(true)).toBe(true);
        });

        it('should handle empty objects and arrays', () => {
            expect(processor.transformResult({})).toEqual({});
            expect(processor.transformResult([])).toEqual([]);
        });
    });

    describe('Configuration options and mapping precedence', () => {
        it('should prioritize column-specific mappings over value-based detection', () => {
            const config: TypeTransformationConfig = {
                enableValueBasedDetection: true,
                columnTransformations: {
                    // Force this date-like string to remain as string
                    user_input: {
                        sourceType: 'custom',
                        targetType: 'string',
                        handleNull: true
                    }
                }
            };

            const processor = new TypeTransformationPostProcessor(config);
            const input = {
                system_date: '2024-01-15T10:30:00Z', // Should be converted to Date
                user_input: '2024-01-01'  // Should remain as string due to mapping
            };

            const result = processor.transformResult(input);

            expect(result.system_date).toBeInstanceOf(Date);
            expect(result.user_input).toBe('2024-01-01'); // Should remain string
            expect(typeof result.user_input).toBe('string');
        });

        it('should disable value-based detection when configured', () => {
            const config: TypeTransformationConfig = {
                enableValueBasedDetection: false,
                columnTransformations: {
                    mapped_date: {
                        sourceType: 'TIMESTAMP',
                        targetType: 'Date',
                        handleNull: true
                    }
                }
            };

            const processor = new TypeTransformationPostProcessor(config);
            const input = {
                unmapped_date: '2024-01-15T10:30:00Z', // Should NOT be converted
                mapped_date: '2024-01-15T10:30:00Z'   // Should be converted due to mapping
            };

            const result = processor.transformResult(input);

            expect(result.unmapped_date).toBe('2024-01-15T10:30:00Z'); // Should remain string
            expect(result.mapped_date).toBeInstanceOf(Date);
        });

        it('should use strict date detection when configured', () => {
            const config: TypeTransformationConfig = {
                enableValueBasedDetection: true,
                strictDateDetection: true
            };

            const processor = new TypeTransformationPostProcessor(config);
            const input = {
                date_only: '2024-01-15',              // Should NOT be converted (no T)
                full_datetime: '2024-01-15T10:30:00Z' // Should be converted (has T)
            };

            const result = processor.transformResult(input);

            expect(result.date_only).toBe('2024-01-15'); // Should remain string
            expect(result.full_datetime).toBeInstanceOf(Date);
        });

        it('should use loose date detection by default', () => {
            const config: TypeTransformationConfig = {
                enableValueBasedDetection: true,
                strictDateDetection: false  // Default
            };

            const processor = new TypeTransformationPostProcessor(config);
            const input = {
                date_only: '2024-01-15',              // Should be converted
                full_datetime: '2024-01-15T10:30:00Z' // Should be converted
            };

            const result = processor.transformResult(input);

            expect(result.date_only).toBeInstanceOf(Date);
            expect(result.full_datetime).toBeInstanceOf(Date);
        });
    });

    describe('Safe configuration', () => {
        it('should create safe config with disabled value-based detection', () => {
            const safeConfig = TypeTransformationPostProcessor.createSafeConfig({
                known_date: {
                    sourceType: 'TIMESTAMP',
                    targetType: 'Date',
                    handleNull: true
                }
            });

            const processor = new TypeTransformationPostProcessor(safeConfig);
            const input = {
                user_input: '2024-01-01',      // Should NOT be converted (no mapping)
                known_date: '2024-01-15T10:30:00Z' // Should be converted (has mapping)
            };

            const result = processor.transformResult(input);

            expect(result.user_input).toBe('2024-01-01'); // Should remain string
            expect(result.known_date).toBeInstanceOf(Date);
        });

        it('should demonstrate security risk with default config', () => {
            const defaultProcessor = new TypeTransformationPostProcessor(
                TypeTransformationPostProcessor.createDefaultConfig()
            );

            // Simulate user input that looks like a date
            const potentiallyMaliciousInput = {
                user_name: 'John Doe',
                user_birthday: '1990-01-01', // User input that looks like date
                comment: 'Meeting on 2024-12-25'  // User comment with date-like string
            };

            const result = defaultProcessor.transformResult(potentiallyMaliciousInput);

            // With default config, these get converted to Date objects
            expect(result.user_name).toBe('John Doe');
            expect(result.user_birthday).toBeInstanceOf(Date); // Converted!
            expect(result.comment).toBe('Meeting on 2024-12-25'); // Not converted (no ISO format)
        });

        it('should be safe with explicit column mappings', () => {
            const safeProcessor = new TypeTransformationPostProcessor(
                TypeTransformationPostProcessor.createSafeConfig({
                    // Only convert columns we explicitly know are dates
                    created_at: {
                        sourceType: 'TIMESTAMP',
                        targetType: 'Date',
                        handleNull: true
                    }
                })
            );

            const userInput = {
                user_name: 'John Doe',
                user_birthday: '1990-01-01',  // User input - should remain string
                created_at: '2024-01-15T10:30:00Z' // System field - should convert
            };

            const result = safeProcessor.transformResult(userInput);

            expect(result.user_name).toBe('John Doe');
            expect(result.user_birthday).toBe('1990-01-01'); // Remains string - safe!            expect(result.created_at).toBeInstanceOf(Date);
        });
    });

    describe('Custom transformations', () => {
        it('should support custom transformers', () => {
            const customProcessor = new TypeTransformationPostProcessor({
                columnTransformations: {
                    'special_field': {
                        sourceType: 'custom',
                        targetType: 'custom',
                        customTransformer: 'toUpperCase'
                    }
                },
                customTransformers: {
                    'toUpperCase': (value: string) => value.toUpperCase()
                }
            });

            const input = {
                special_field: 'hello world',
                regular_field: 'unchanged'
            };

            const result = customProcessor.transformResult(input);

            expect(result.special_field).toBe('HELLO WORLD');
            expect(result.regular_field).toBe('unchanged');
        });

        it('should support custom global transformations', () => {
            const defaultConfig = TypeTransformationPostProcessor.createDefaultConfig();
            const customProcessor = new TypeTransformationPostProcessor({
                globalTransformations: {
                    ...defaultConfig.globalTransformations,
                    'CUSTOM_DATE': {
                        sourceType: 'custom',
                        targetType: 'Date',
                        handleNull: true,
                        validator: (value: any) => typeof value === 'string' && value.includes('T')
                    }
                }
            });

            const input = {
                normal_date: '2024-01-15T10:30:00.000Z',
                regular_field: 'unchanged'
            };

            const result = customProcessor.transformResult(input);

            expect(result.normal_date).toBeInstanceOf(Date);
            expect(result.regular_field).toBe('unchanged');
        });
    });

    describe('Potentially problematic strings', () => {
        it('should handle strings that look like dates but are not', () => {
            const problematicStrings = {
                comment1: "Project started on 2022-01-01",
                comment2: "Release version 2024-12-25",
                productCode: "PROD-2023-01-15-001",
                filename: "backup-2024-01-01.sql",
                logEntry: "Error on 2023-12-31: Connection failed",
                mixedText: "Today is 2024-01-15, tomorrow is 2024-01-16",
                path: "/logs/2024-01-01/error.log",
                sql: "WHERE created_at > '2024-01-01'",
                justDate: "2024-01-01",                    // This WILL be converted
                dateInQuotes: "'2024-01-01'",              // Should NOT be converted
                dateWithPrefix: "Date: 2024-01-01",        // Should NOT be converted
                dateWithSuffix: "2024-01-01 was Monday",   // Should NOT be converted
                isoDateTime: "2024-01-01T10:30:00.000Z",   // Should be converted
                isoDate: "2024-01-01"                      // Should be converted
            };

            const transformed = transformDatabaseResult(problematicStrings);

            // Only pure ISO format strings should be converted
            expect(transformed.justDate).toBeInstanceOf(Date);
            expect(transformed.isoDateTime).toBeInstanceOf(Date);
            expect(transformed.isoDate).toBeInstanceOf(Date);

            // Mixed text should remain as strings
            expect(transformed.comment1).toBe("Project started on 2022-01-01");
            expect(transformed.comment2).toBe("Release version 2024-12-25");
            expect(transformed.productCode).toBe("PROD-2023-01-15-001");
            expect(transformed.filename).toBe("backup-2024-01-01.sql");
            expect(transformed.logEntry).toBe("Error on 2023-12-31: Connection failed");
            expect(transformed.mixedText).toBe("Today is 2024-01-15, tomorrow is 2024-01-16");
            expect(transformed.path).toBe("/logs/2024-01-01/error.log");
            expect(transformed.sql).toBe("WHERE created_at > '2024-01-01'");
            expect(transformed.dateInQuotes).toBe("'2024-01-01'");
            expect(transformed.dateWithPrefix).toBe("Date: 2024-01-01");
            expect(transformed.dateWithSuffix).toBe("2024-01-01 was Monday");
        });
    });

    describe('Security considerations', () => {
        it('should demonstrate potential security risks with value-based detection', () => {
            const maliciousInputs = {
                userComment1: "2024-01-01",                    // Will be converted to Date!
                userComment2: "2024-12-25",                    // Will be converted to Date!
                userPost: "2023-01-01",                        // Will be converted to Date!
                userBio: "1990-05-15",                         // Will be converted to Date!
                safeComment1: "Today was 2024-01-01",          // Safe (mixed text)
                safeComment2: "Meeting on 2024-01-01 at 3pm", // Safe (mixed text)
                safeComment3: "'2024-01-01'",                  // Safe (quoted)
                isoDatetime: "2024-01-01T00:00:00.000Z",       // Will be converted to Date!
                justYear: "2024",                              // Safe (not date pattern)
                justMonth: "01-01"                             // Safe (not full date)
            };

            const attackResult = transformDatabaseResult(maliciousInputs);

            // These user inputs get compromised by auto-conversion
            expect(attackResult.userComment1).toBeInstanceOf(Date);
            expect(attackResult.userComment2).toBeInstanceOf(Date);
            expect(attackResult.userPost).toBeInstanceOf(Date);
            expect(attackResult.userBio).toBeInstanceOf(Date);
            expect(attackResult.isoDatetime).toBeInstanceOf(Date);

            // These remain safe
            expect(attackResult.safeComment1).toBe("Today was 2024-01-01");
            expect(attackResult.safeComment2).toBe("Meeting on 2024-01-01 at 3pm");
            expect(attackResult.safeComment3).toBe("'2024-01-01'");
            expect(attackResult.justYear).toBe("2024");
            expect(attackResult.justMonth).toBe("01-01");
        });
    });
});
