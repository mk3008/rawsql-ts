import { BaseTokenReader } from './BaseTokenReader';
import { Lexeme } from '../models/Lexeme';

/**
 * Manages and coordinates multiple token readers
 */
export class TokenReaderManager {
    private readers: BaseTokenReader[];
    private input: string;
    private position: number;

    constructor(input: string, position: number = 0) {
        this.input = input;
        this.position = position;
        this.readers = [];
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
     * Try to read a token using all registered readers
     * @param position The position to read from
     * @param previous The previous token, if any
     * @returns The lexeme if a reader could read it, null otherwise
     */
    public tryRead(position: number, previous: Lexeme | null): Lexeme | null {
        this.position = position;

        // Set reader position lazily so we avoid touching readers after the winning parser.
        for (const reader of this.readers) {
            reader.setPosition(position);
            const lexeme = reader.tryRead(previous);
            if (lexeme) {
                this.position = reader.getPosition();
                return lexeme;
            }
        }

        return null;
    }

    /**
     * Get the maximum position among all readers
     */
    public getMaxPosition(): number {
        return this.position;
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
        return {
            hits: 0,
            misses: 0,
            ratio: 0
        };
    }
}
