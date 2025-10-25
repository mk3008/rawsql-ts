import { SqlComponent } from "./SqlComponent";
import {
    QualifiedName,
    IdentifierString,
    ValueComponent,
    RawString
} from "./ValueComponent";
import {
    TableConstraintDefinition
} from "./CreateTableQuery";

export type DropBehavior = 'cascade' | 'restrict' | null;
export type IndexSortOrder = 'asc' | 'desc' | null;
export type IndexNullsOrder = 'first' | 'last' | null;

/**
 * DROP TABLE statement representation.
 */
export class DropTableStatement extends SqlComponent {
    static kind = Symbol("DropTableStatement");
    tables: QualifiedName[];
    ifExists: boolean;
    behavior: DropBehavior;

    constructor(params: { tables: QualifiedName[]; ifExists?: boolean; behavior?: DropBehavior }) {
        super();
        this.tables = params.tables.map(table => new QualifiedName(table.namespaces, table.name));
        this.ifExists = params.ifExists ?? false;
        this.behavior = params.behavior ?? null;
    }
}

/**
 * DROP INDEX statement representation.
 */
export class DropIndexStatement extends SqlComponent {
    static kind = Symbol("DropIndexStatement");
    indexNames: QualifiedName[];
    ifExists: boolean;
    concurrently: boolean;
    behavior: DropBehavior;

    constructor(params: {
        indexNames: QualifiedName[];
        ifExists?: boolean;
        concurrently?: boolean;
        behavior?: DropBehavior;
    }) {
        super();
        this.indexNames = params.indexNames.map(index => new QualifiedName(index.namespaces, index.name));
        this.ifExists = params.ifExists ?? false;
        this.concurrently = params.concurrently ?? false;
        this.behavior = params.behavior ?? null;
    }
}

/**
 * Column definition within CREATE INDEX clause.
 */
export class IndexColumnDefinition extends SqlComponent {
    static kind = Symbol("IndexColumnDefinition");
    expression: ValueComponent;
    sortOrder: IndexSortOrder;
    nullsOrder: IndexNullsOrder;
    collation?: QualifiedName | null;
    operatorClass?: QualifiedName | null;

    constructor(params: {
        expression: ValueComponent;
        sortOrder?: IndexSortOrder;
        nullsOrder?: IndexNullsOrder;
        collation?: QualifiedName | null;
        operatorClass?: QualifiedName | null;
    }) {
        super();
        this.expression = params.expression;
        this.sortOrder = params.sortOrder ?? null;
        this.nullsOrder = params.nullsOrder ?? null;
        this.collation = params.collation ?? null;
        this.operatorClass = params.operatorClass ?? null;
    }
}

/**
 * CREATE INDEX statement representation.
 */
export class CreateIndexStatement extends SqlComponent {
    static kind = Symbol("CreateIndexStatement");
    unique: boolean;
    concurrently: boolean;
    ifNotExists: boolean;
    indexName: QualifiedName;
    tableName: QualifiedName;
    usingMethod?: IdentifierString | RawString | null;
    columns: IndexColumnDefinition[];
    include?: IdentifierString[] | null;
    where?: ValueComponent;
    withOptions?: RawString | null;
    tablespace?: IdentifierString | null;

    constructor(params: {
        unique?: boolean;
        concurrently?: boolean;
        ifNotExists?: boolean;
        indexName: QualifiedName;
        tableName: QualifiedName;
        usingMethod?: IdentifierString | RawString | null;
        columns: IndexColumnDefinition[];
        include?: IdentifierString[] | null;
        where?: ValueComponent;
        withOptions?: RawString | null;
        tablespace?: IdentifierString | null;
    }) {
        super();
        this.unique = params.unique ?? false;
        this.concurrently = params.concurrently ?? false;
        this.ifNotExists = params.ifNotExists ?? false;
        this.indexName = new QualifiedName(params.indexName.namespaces, params.indexName.name);
        this.tableName = new QualifiedName(params.tableName.namespaces, params.tableName.name);
        this.usingMethod = params.usingMethod ?? null;
        this.columns = params.columns.map(col => new IndexColumnDefinition({
            expression: col.expression,
            sortOrder: col.sortOrder,
            nullsOrder: col.nullsOrder,
            collation: col.collation ?? null,
            operatorClass: col.operatorClass ?? null
        }));
        this.include = params.include ? [...params.include] : null;
        this.where = params.where;
        this.withOptions = params.withOptions ?? null;
        this.tablespace = params.tablespace ?? null;
    }
}

/**
 * ALTER TABLE ... ADD CONSTRAINT action.
 */
export class AlterTableAddConstraint extends SqlComponent {
    static kind = Symbol("AlterTableAddConstraint");
    constraint: TableConstraintDefinition;
    ifNotExists: boolean;
    notValid: boolean;

    constructor(params: {
        constraint: TableConstraintDefinition;
        ifNotExists?: boolean;
        notValid?: boolean;
    }) {
        super();
        this.constraint = params.constraint;
        this.ifNotExists = params.ifNotExists ?? false;
        this.notValid = params.notValid ?? false;
    }
}

/**
 * ALTER TABLE ... DROP CONSTRAINT action.
 */
export class AlterTableDropConstraint extends SqlComponent {
    static kind = Symbol("AlterTableDropConstraint");
    constraintName: IdentifierString;
    ifExists: boolean;
    behavior: DropBehavior;

    constructor(params: {
        constraintName: IdentifierString;
        ifExists?: boolean;
        behavior?: DropBehavior;
    }) {
        super();
        this.constraintName = params.constraintName;
        this.ifExists = params.ifExists ?? false;
        this.behavior = params.behavior ?? null;
    }
}

export type AlterTableAction = AlterTableAddConstraint | AlterTableDropConstraint;

/**
 * ALTER TABLE statement representation with constraint-centric actions.
 */
export class AlterTableStatement extends SqlComponent {
    static kind = Symbol("AlterTableStatement");
    table: QualifiedName;
    only: boolean;
    ifExists: boolean;
    actions: AlterTableAction[];

    constructor(params: {
        table: QualifiedName;
        only?: boolean;
        ifExists?: boolean;
        actions: AlterTableAction[];
    }) {
        super();
        this.table = new QualifiedName(params.table.namespaces, params.table.name);
        this.only = params.only ?? false;
        this.ifExists = params.ifExists ?? false;
        this.actions = params.actions.map(action => action);
    }
}

/**
 * Standalone DROP CONSTRAINT statement representation.
 */
export class DropConstraintStatement extends SqlComponent {
    static kind = Symbol("DropConstraintStatement");
    constraintName: IdentifierString;
    ifExists: boolean;
    behavior: DropBehavior;

    constructor(params: { constraintName: IdentifierString; ifExists?: boolean; behavior?: DropBehavior }) {
        super();
        this.constraintName = params.constraintName;
        this.ifExists = params.ifExists ?? false;
        this.behavior = params.behavior ?? null;
    }
}
