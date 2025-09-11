/**
 * Represents a comment with its position relative to a token or component
 */
export interface PositionedComment {
    position: 'before' | 'after';
    comments: string[];
}

export abstract class SqlComponent {
    // `kind` is declared abstractly and defined concretely in a subclass.
    static kind: symbol;

    getKind(): symbol {
        return (this.constructor as typeof SqlComponent).kind;
    }

    accept<T>(visitor: SqlComponentVisitor<T>): T {
        return visitor.visit(this);
    }

    toSqlString(formatter: SqlComponentVisitor<string>): string {
        return this.accept(formatter);
    }

    // Legacy comment field for backward compatibility
    comments: string[] | null = null;
    
    // New position-based comment system
    positionedComments: PositionedComment[] | null = null;

    /**
     * Add comments at a specific position
     */
    addPositionedComments(position: 'before' | 'after', comments: string[]): void {
        if (!comments || comments.length === 0) return;
        
        if (!this.positionedComments) {
            this.positionedComments = [];
        }
        
        // Find existing positioned comment for this position
        const existing = this.positionedComments.find(pc => pc.position === position);
        if (existing) {
            existing.comments.push(...comments);
        } else {
            this.positionedComments.push({ position, comments: [...comments] });
        }
    }

    /**
     * Get comments for a specific position
     */
    getPositionedComments(position: 'before' | 'after'): string[] {
        if (!this.positionedComments) return [];
        
        const positioned = this.positionedComments.find(pc => pc.position === position);
        return positioned ? positioned.comments : [];
    }

    /**
     * Get all positioned comments as a flat array in order (before, after)
     */
    getAllPositionedComments(): string[] {
        if (!this.positionedComments) return [];
        
        const result: string[] = [];
        
        // Add 'before' comments first
        const beforeComments = this.getPositionedComments('before');
        result.push(...beforeComments);
        
        // Add 'after' comments second
        const afterComments = this.getPositionedComments('after');
        result.push(...afterComments);
        
        return result;
    }
}

export interface SqlComponentVisitor<T> {
    visit(expr: SqlComponent): T;
}

export class SqlDialectConfiguration {
    public parameterSymbol: string = ":";
    public identifierEscape = { start: '"', end: '"' };
    public exportComment: boolean = true;
}
