import { BaseTokenReader } from './BaseTokenReader';
import { Lexeme, TokenType } from '../models/Lexeme';

/**
 * Manages and coordinates multiple token readers
 */
export class TokenReaderManager {
    private readers: BaseTokenReader[];
    private input: string;
    private position: number;
    private tokenCache: Map<number, Lexeme | null>;
    private cacheHits: number = 0;
    private cacheMisses: number = 0;

    constructor(input: string, position: number = 0) {
        this.input = input;
        this.position = position;
        this.readers = [];
        this.tokenCache = new Map();
    }

    /**
     * Register a token reader
     * @param reader The reader to register
     * @returns This manager instance for chaining
     */
    public register(reader: BaseTokenReader): TokenReaderManager {
        this.readers.push(reader);
        return this;
    }

    /**
     * Register multiple token readers
     * @param readers The readers to register
     * @returns This manager instance for chaining
     */
    public registerAll(readers: BaseTokenReader[]): TokenReaderManager {
        readers.forEach(reader => this.register(reader));
        return this;
    }

    /**
     * Update the position for all readers
     */
    private setPosition(position: number): void {
        this.position = position;
        for (const reader of this.readers) {
            reader.setPosition(position);
        }
    }

    /**
     * Try to read a token using all registered readers
     * @param position The position to read from
     * @param previous The previous token, if any
     * @returns The lexeme if a reader could read it, null otherwise
     */
    public tryRead(position: number, previous: Lexeme | null): Lexeme | null {
        // Check cache - using position as the key
        if (this.tokenCache.has(position)) {
            // Cache hit
            this.cacheHits++;
            const lexeme = this.tokenCache.get(position) || null;
            return lexeme;
        }

        // Cache miss - create new entry
        this.cacheMisses++;
        this.setPosition(position);

        // Try to read with each reader
        let lexeme: Lexeme | null = null;
        for (const reader of this.readers) {
            lexeme = reader.tryRead(previous);
            if (lexeme) {
                this.position = reader.getPosition();
                break;
            }
        }

        // Update all readers' positions
        for (const reader of this.readers) {
            reader.setPosition(this.position);
        }

        // Save to cache (even if null)
        this.tokenCache.set(position, lexeme);
        return lexeme;
    }

    /**
     * Get the maximum position among all readers
     */
    public getMaxPosition(): number {
        let maxPosition = this.position;
        for (const reader of this.readers) {
            const position = reader.getPosition();
            if (position > maxPosition) {
                maxPosition = position;
            }
        }
        return maxPosition;
    }

    /**
     * Get the input string
     */
    public getInput(): string {
        return this.input;
    }

    /**
     * Get cache statistics
     */
    public getCacheStats(): { hits: number, misses: number, ratio: number } {
        const total = this.cacheHits + this.cacheMisses;
        const ratio = total > 0 ? this.cacheHits / total : 0;
        return {
            hits: this.cacheHits,
            misses: this.cacheMisses,
            ratio: ratio
        };
    }
}
