import { SqlComponent } from "./SqlComponent";
import { InsertQuery } from "./InsertQuery";
import { SimpleSelectQuery } from "./SimpleSelectQuery";
import { BinarySelectQuery } from "./BinarySelectQuery";
import { ValuesQuery } from "./ValuesQuery";

export interface SelectQuery extends SqlComponent {
    setParameter(name: string, value: any): this;
}
export { SimpleSelectQuery, BinarySelectQuery, ValuesQuery, InsertQuery };
