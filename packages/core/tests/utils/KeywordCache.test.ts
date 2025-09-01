import { describe, it, expect, beforeEach } from 'vitest';
import { KeywordCache } from '../../src/utils/KeywordCache';

describe('KeywordCache', () => {
    beforeEach(() => {
        KeywordCache.reset();
    });

    describe('JOIN keyword suggestions', () => {
        it('should suggest complete JOIN options after LEFT for better UX', () => {
            const suggestions = KeywordCache.getJoinSuggestions('left');
            expect(suggestions).toEqual(['JOIN', 'OUTER JOIN']);
        });

        it('should suggest JOIN after INNER', () => {
            const suggestions = KeywordCache.getJoinSuggestions('inner');
            expect(suggestions).toEqual(['JOIN']);
        });

        it('should suggest JOIN after OUTER', () => {
            const suggestions = KeywordCache.getJoinSuggestions('outer');
            expect(suggestions).toEqual(['JOIN']);
        });

        it('should suggest complete JOIN options after RIGHT for better UX', () => {
            const suggestions = KeywordCache.getJoinSuggestions('right');
            expect(suggestions).toEqual(['JOIN', 'OUTER JOIN']);
        });

        it('should suggest complete JOIN options after FULL for better UX', () => {
            const suggestions = KeywordCache.getJoinSuggestions('full');
            expect(suggestions).toEqual(['JOIN', 'OUTER JOIN']);
        });

        it('should return empty array for unknown keywords', () => {
            const suggestions = KeywordCache.getJoinSuggestions('unknown');
            expect(suggestions).toEqual([]);
        });
    });

    describe('Command keyword suggestions', () => {
        it('should suggest BY after GROUP', () => {
            const suggestions = KeywordCache.getCommandSuggestions('group');
            expect(suggestions).toEqual(['by']);
        });

        it('should suggest BY after ORDER', () => {
            const suggestions = KeywordCache.getCommandSuggestions('order');
            expect(suggestions).toEqual(['by']);
        });

        it('should suggest ON after DISTINCT', () => {
            const suggestions = KeywordCache.getCommandSuggestions('distinct');
            expect(suggestions).toEqual(['on']);
        });

        it('should suggest MATERIALIZED after NOT', () => {
            const suggestions = KeywordCache.getCommandSuggestions('not');
            expect(suggestions).toEqual(['materialized']);
        });

        it('should return empty array for unknown command keywords', () => {
            const suggestions = KeywordCache.getCommandSuggestions('unknown');
            expect(suggestions).toEqual([]);
        });
    });

    describe('LATERAL JOIN keyword suggestions', () => {
        it('should suggest complete JOIN options after LATERAL', () => {
            const suggestions = KeywordCache.getJoinSuggestions('lateral');
            expect(suggestions).toEqual(['JOIN', 'INNER JOIN', 'LEFT JOIN', 'LEFT OUTER JOIN']);
        });
    });

    describe('Validation methods', () => {
        it('should validate JOIN keywords correctly', () => {
            expect(KeywordCache.isValidJoinKeyword('left join')).toBe(true);
            expect(KeywordCache.isValidJoinKeyword('inner join')).toBe(true);
            expect(KeywordCache.isValidJoinKeyword('invalid join')).toBe(false);
        });

        it('should get all JOIN keywords', () => {
            const allKeywords = KeywordCache.getAllJoinKeywords();
            expect(allKeywords).toContain('left');
            expect(allKeywords).toContain('JOIN');
            expect(allKeywords).toContain('inner');
            expect(allKeywords).toContain('outer');
        });
    });

    describe('Partial suggestions', () => {
        it('should provide partial suggestions for incomplete input', () => {
            const suggestions = KeywordCache.getPartialSuggestions('le');
            expect(suggestions).toContain('left');
        });

        it('should handle empty partial input', () => {
            const suggestions = KeywordCache.getPartialSuggestions('');
            expect(Array.isArray(suggestions)).toBe(true);
        });
    });

    describe('Cache management', () => {
        it('should reset cache properly', () => {
            // First call initializes cache
            KeywordCache.getJoinSuggestions('left');
            
            // Reset should clear cache
            KeywordCache.reset();
            
            // Should work after reset
            const suggestions = KeywordCache.getJoinSuggestions('left');
            expect(suggestions).toEqual(['JOIN', 'OUTER JOIN']);
        });
    });
});