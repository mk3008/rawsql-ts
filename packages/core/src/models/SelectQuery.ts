import { SqlComponent } from "./SqlComponent";
import { InsertQuery } from "./InsertQuery";
import { SimpleSelectQuery } from "./SimpleSelectQuery";
import { BinarySelectQuery } from "./BinarySelectQuery";
import { ValuesQuery } from "./ValuesQuery";
import { SqlParameterValue } from "./ValueComponent";

export interface CTEOptions {
    materialized?: boolean | null;
}

export { DuplicateCTEError, InvalidCTENameError, CTENotFoundError } from './CTEError';

export interface CTEManagement {
    addCTE(name: string, query: SelectQuery, options?: CTEOptions): this;
    removeCTE(name: string): this;
    hasCTE(name: string): boolean;
    getCTENames(): string[];
    replaceCTE(name: string, query: SelectQuery, options?: CTEOptions): this;
}

export interface SelectQuery extends SqlComponent {
    readonly __selectQueryType: 'SelectQuery'; // Discriminator property for type safety
    headerComments: string[] | null;
    setParameter(name: string, value: SqlParameterValue): this;
    toSimpleQuery(): SimpleSelectQuery;
}
export { SimpleSelectQuery, BinarySelectQuery, ValuesQuery, InsertQuery };
