import { SqlComponent } from "./SqlComponent";
import {
    QualifiedName,
    IdentifierString,
    ValueComponent,
    RawString
} from "./ValueComponent";
import {
    TableConstraintDefinition,
    TableColumnDefinition
} from "./CreateTableQuery";

export type DropBehavior = 'cascade' | 'restrict' | null;
export type IndexSortOrder = 'asc' | 'desc' | null;
export type IndexNullsOrder = 'first' | 'last' | null;

function cloneIdentifierWithComments(identifier: IdentifierString): IdentifierString {
    const clone = new IdentifierString(identifier.name);

    // Preserve positioned comment metadata while cloning identifiers.
    if (identifier.positionedComments) {
        clone.positionedComments = identifier.positionedComments.map(entry => ({
            position: entry.position,
            comments: [...entry.comments],
        }));
    } else if (identifier.comments && identifier.comments.length > 0) {
        // Copy legacy comment arrays when no positioned comments exist.
        clone.comments = [...identifier.comments];
    }

    return clone;
}

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
 * CREATE SCHEMA statement representation.
 */
export class CreateSchemaStatement extends SqlComponent {
    static kind = Symbol("CreateSchemaStatement");
    schemaName: QualifiedName;
    ifNotExists: boolean;
    authorization: IdentifierString | null;

    constructor(params: { schemaName: QualifiedName; ifNotExists?: boolean; authorization?: IdentifierString | null }) {
        super();
        this.schemaName = new QualifiedName(params.schemaName.namespaces, params.schemaName.name);
        this.ifNotExists = params.ifNotExists ?? false;
        this.authorization = params.authorization ? cloneIdentifierWithComments(params.authorization) : null;
    }
}

/**
 * DROP SCHEMA statement representation.
 */
export class DropSchemaStatement extends SqlComponent {
    static kind = Symbol("DropSchemaStatement");
    schemaNames: QualifiedName[];
    ifExists: boolean;
    behavior: DropBehavior;

    constructor(params: { schemaNames: QualifiedName[]; ifExists?: boolean; behavior?: DropBehavior }) {
        super();
        this.schemaNames = params.schemaNames.map(schema => new QualifiedName(schema.namespaces, schema.name));
        this.ifExists = params.ifExists ?? false;
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

/**
 * ALTER TABLE ... DROP COLUMN action.
 */
export class AlterTableDropColumn extends SqlComponent {
    static kind = Symbol("AlterTableDropColumn");
    columnName: IdentifierString;
    ifExists: boolean;
    behavior: DropBehavior;

    constructor(params: {
        columnName: IdentifierString;
        ifExists?: boolean;
        behavior?: DropBehavior;
    }) {
        super();
        this.columnName = params.columnName;
        this.ifExists = params.ifExists ?? false;
        this.behavior = params.behavior ?? null;
    }
}

/**
 * ALTER TABLE ... ADD COLUMN action.
 */
export class AlterTableAddColumn extends SqlComponent {
    static kind = Symbol("AlterTableAddColumn");
    column: TableColumnDefinition;
    ifNotExists: boolean;

    constructor(params: {
        column: TableColumnDefinition;
        ifNotExists?: boolean;
    }) {
        super();
        this.column = params.column;
        this.ifNotExists = params.ifNotExists ?? false;
    }
}

/**
 * ALTER TABLE ... ALTER COLUMN ... SET/DROP DEFAULT action.
 */
export class AlterTableAlterColumnDefault extends SqlComponent {
    static kind = Symbol("AlterTableAlterColumnDefault");
    columnName: IdentifierString;
    setDefault: ValueComponent | null;
    dropDefault: boolean;

    constructor(params: {
        columnName: IdentifierString;
        setDefault?: ValueComponent | null;
        dropDefault?: boolean;
    }) {
        super();
        this.columnName = params.columnName;
        this.setDefault = params.setDefault ?? null;
        this.dropDefault = params.dropDefault ?? false;
        // Guard against constructing an action that tries to both set and drop the default.
        if (this.setDefault !== null && this.dropDefault) {
            throw new Error("[AlterTableAlterColumnDefault] Cannot set and drop a default at the same time.");
        }
    }
}

export type AlterTableAction =
    | AlterTableAddConstraint
    | AlterTableDropConstraint
    | AlterTableDropColumn
    | AlterTableAddColumn
    | AlterTableAlterColumnDefault;

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

/**
 * Option entry within an EXPLAIN statement.
 */
export class ExplainOption extends SqlComponent {
    static kind = Symbol("ExplainOption");
    name: IdentifierString;
    value: ValueComponent | null;

    constructor(params: { name: IdentifierString; value?: ValueComponent | null }) {
        super();
        // Clone the option name so explain options keep associated metadata.
        this.name = cloneIdentifierWithComments(params.name);
        this.value = params.value ?? null;
    }
}

/**
 * EXPLAIN statement representation.
 */
export class ExplainStatement extends SqlComponent {
    static kind = Symbol("ExplainStatement");
    options: ExplainOption[] | null;
    statement: SqlComponent;

    constructor(params: { options?: ExplainOption[] | null; statement: SqlComponent }) {
        super();
        this.options = params.options ? params.options.map(option => new ExplainOption(option)) : null;
        this.statement = params.statement;
    }
}

/**
 * ANALYZE statement representation.
 */
export class AnalyzeStatement extends SqlComponent {
    static kind = Symbol("AnalyzeStatement");
    verbose: boolean;
    target: QualifiedName | null;
    columns: IdentifierString[] | null;

    constructor(params?: { verbose?: boolean; target?: QualifiedName | null; columns?: IdentifierString[] | null }) {
        super();
        this.verbose = params?.verbose ?? false;
        this.target = params?.target
            ? new QualifiedName(params.target.namespaces, params.target.name)
            : null;
        if (params?.columns) {
            // Clone target columns so position-aware comments remain intact.
            this.columns = params.columns.map(cloneIdentifierWithComments);
        } else {
            this.columns = null;
        }
    }
}

/**
 * Sequence option clauses are collected in order and emitted as the user wrote them.
 * Each clause is specialized by its discriminating `kind`.
 */
export interface SequenceIncrementClause {
    kind: "increment";
    value: ValueComponent;
}

export interface SequenceStartClause {
    kind: "start";
    value: ValueComponent;
}

export interface SequenceMinValueClause {
    kind: "minValue";
    value?: ValueComponent;
    noValue?: boolean;
}

export interface SequenceMaxValueClause {
    kind: "maxValue";
    value?: ValueComponent;
    noValue?: boolean;
}

export interface SequenceCacheClause {
    kind: "cache";
    value?: ValueComponent;
    noValue?: boolean;
}

export interface SequenceCycleClause {
    kind: "cycle";
    enabled: boolean;
}

export interface SequenceRestartClause {
    kind: "restart";
    value?: ValueComponent;
}

export interface SequenceOwnedByClause {
    kind: "ownedBy";
    target?: QualifiedName;
    none?: boolean;
}

export type SequenceOptionClause =
    | SequenceIncrementClause
    | SequenceStartClause
    | SequenceMinValueClause
    | SequenceMaxValueClause
    | SequenceCacheClause
    | SequenceCycleClause
    | SequenceRestartClause
    | SequenceOwnedByClause;

/**
 * CREATE SEQUENCE statement representation.
 */
export class CreateSequenceStatement extends SqlComponent {
    static kind = Symbol("CreateSequenceStatement");
    sequenceName: QualifiedName;
    ifNotExists: boolean;
    clauses: SequenceOptionClause[];

    constructor(params: { sequenceName: QualifiedName; ifNotExists?: boolean; clauses?: SequenceOptionClause[] }) {
        super();
        this.sequenceName = new QualifiedName(params.sequenceName.namespaces, params.sequenceName.name);
        this.ifNotExists = params.ifNotExists ?? false;
        this.clauses = params.clauses ? [...params.clauses] : [];
    }
}

/**
 * ALTER SEQUENCE statement representation.
 */
export class AlterSequenceStatement extends SqlComponent {
    static kind = Symbol("AlterSequenceStatement");
    sequenceName: QualifiedName;
    ifExists: boolean;
    clauses: SequenceOptionClause[];

    constructor(params: { sequenceName: QualifiedName; ifExists?: boolean; clauses?: SequenceOptionClause[] }) {
        super();
        this.sequenceName = new QualifiedName(params.sequenceName.namespaces, params.sequenceName.name);
        this.ifExists = params.ifExists ?? false;
        this.clauses = params.clauses ? [...params.clauses] : [];
    }
}
