import { describe, it, expect } from 'vitest';
import { LiteralTokenReader } from '../../src/tokenReaders/LiteralTokenReader';

describe('LiteralTokenReader Repro', () => {
    it('should correctly read double escaped single quotes', () => {
        const input = "'Bob''''s Post'";
        const reader = new LiteralTokenReader(input);
        const token = reader.tryRead(null);
        expect(token).not.toBeNull();
        expect(token!.value).toBe("'Bob''''s Post'");
    });

    it('should correctly read single escaped single quotes', () => {
        const input = "'Bob''s Post'";
        const reader = new LiteralTokenReader(input);
        const token = reader.tryRead(null);
        expect(token).not.toBeNull();
        expect(token!.value).toBe("'Bob''s Post'");
    });
});
