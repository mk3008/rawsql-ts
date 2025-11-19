import { describe, it, expect } from 'vitest';
import { InsertQueryParser } from '../../src/parsers/InsertQueryParser';

describe('InsertQueryParser - RETURNING clause reproduction', () => {
    it('should parse RETURNING clause with function call', () => {
        const sql = "INSERT INTO users (name, email) VALUES ('Alice', 'alice@example.com') RETURNING lower(name)";
        const result = InsertQueryParser.parse(sql);
        expect(result).toBeDefined();
        expect(result.returningClause).toBeDefined();
        expect(result.returningClause!.items.length).toBe(1);
    });

    it('should parse RETURNING clause with multiple expressions', () => {
        const sql = "INSERT INTO users (name, email) VALUES ('Alice', 'alice@example.com') RETURNING id, lower(name) as lower_name";
        const result = InsertQueryParser.parse(sql);
        expect(result).toBeDefined();
        expect(result.returningClause).toBeDefined();
        expect(result.returningClause!.items.length).toBe(2);
    });
});
