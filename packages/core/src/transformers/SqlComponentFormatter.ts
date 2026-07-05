import { SelectQuery, SimpleSelectQuery } from "../models/SelectQuery";
import { ValueComponent } from "../models/ValueComponent";
import { SqlFormatter, SqlFormatterOptions } from "./SqlFormatter";

export type FormattableSqlComponent = SelectQuery | SimpleSelectQuery | ValueComponent;

export type SqlComponentFormatter = (component: FormattableSqlComponent) => string;

export interface SqlComponentFormatOptions {
    formatter?: SqlComponentFormatter;
    formatOptions?: SqlFormatterOptions;
}

let formatter: SqlFormatter | null = null;

export const formatSqlComponent = (
    component: FormattableSqlComponent,
    options: SqlComponentFormatOptions = {}
): string => {
    if (options.formatter) {
        return options.formatter(component);
    }

    if (options.formatOptions) {
        return new SqlFormatter({ exportComment: true, ...options.formatOptions }).format(component).formattedSql;
    }

    formatter ??= new SqlFormatter({ exportComment: true });
    return formatter.format(component).formattedSql;
};

export const hasSqlComponentFormatOverride = (options: SqlComponentFormatOptions = {}): boolean => {
    return Boolean(options.formatter || options.formatOptions);
};
