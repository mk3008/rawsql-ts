/**
 * Error thrown when a CTE with the same name already exists
 */
export class DuplicateCTEError extends Error {
    constructor(public cteName: string) {
        super(`CTE '${cteName}' already exists in the query`);
        this.name = 'DuplicateCTEError';
    }
}

/**
 * Error thrown when a CTE name is invalid
 */
export class InvalidCTENameError extends Error {
    constructor(public cteName: string, reason: string) {
        super(`Invalid CTE name '${cteName}': ${reason}`);
        this.name = 'InvalidCTENameError';
    }
}

/**
 * Error thrown when trying to operate on a non-existent CTE
 */
export class CTENotFoundError extends Error {
    constructor(public cteName: string) {
        super(`CTE '${cteName}' not found in the query`);
        this.name = 'CTENotFoundError';
    }
}