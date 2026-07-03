import { SelectQuery, SimpleSelectQuery } from "../models/SelectQuery";
import { ValueComponent } from "../models/ValueComponent";
import { SqlFormatter } from "./SqlFormatter";

let formatter: SqlFormatter | null = null;

export const formatSqlComponent = (component: SelectQuery | SimpleSelectQuery | ValueComponent): string => {
    formatter ??= new SqlFormatter({ exportComment: true });
    return formatter.format(component).formattedSql;
};
