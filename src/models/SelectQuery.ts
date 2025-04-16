import { SimpleSelectQuery } from "./SimpleSelectQuery";
import { BinarySelectQuery } from "./BinarySelectQuery";
import { ValuesQuery } from "./ValuesQuery";

export type SelectQuery = SimpleSelectQuery | BinarySelectQuery | ValuesQuery;
export { SimpleSelectQuery, BinarySelectQuery, ValuesQuery };
