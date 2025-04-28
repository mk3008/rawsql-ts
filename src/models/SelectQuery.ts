import { InsertQuery } from "./InsertQuery";
import { SimpleSelectQuery } from "./SimpleSelectQuery";
import { BinarySelectQuery } from "./BinarySelectQuery";
import { ValuesQuery } from "./ValuesQuery";

export type SelectQuery = SimpleSelectQuery | BinarySelectQuery | ValuesQuery | InsertQuery;
export { SimpleSelectQuery, BinarySelectQuery, ValuesQuery, InsertQuery };
