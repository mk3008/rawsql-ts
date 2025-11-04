export enum SqlPrintTokenType {
    container = 0,
    keyword,
    value, // Represents non-keyword elements such as table names
    comma, // Represents comma ','
    parenthesis, // Represents parentheses: ( ) { } [ ]
    operator, // Represents operators such as +, -, *, /
    comment, // SQL comments /* */ or --
    parameter,
    dot,
    type,
    space, // Whitespace characters
    argumentSplitter,
    commentNewline, // Conditional newline after comments (multiline mode only)
}

// Enum for container type, used for formatting and context
export enum SqlPrintTokenContainerType {
    ColumnReference = 'ColumnReference',
    LiteralValue = 'LiteralValue',
    IdentifierString = 'IdentifierString',
    InlineQuery = 'InlineQuery',
    StringSpecifierExpression = 'StringSpecifierExpression',
    None = '',
    ValueList = 'ValueList',
    OrderByItem = 'OrderByItem',
    FunctionCall = 'FunctionCall',
    UnaryExpression = 'UnaryExpression',
    BinaryExpression = 'BinaryExpression',
    SwitchCaseArgument = 'SwitchCaseArgument',
    ElseClause = 'ElseClause',
    CaseKeyValuePair = 'CaseKeyValuePair',
    CaseThenValue = 'CaseThenValue',
    CaseElseValue = 'CaseElseValue',
    ParenExpression = 'ParenExpression',
    CastExpression = 'CastExpression',
    CaseExpression = 'CaseExpression',
    ArrayExpression = 'ArrayExpression',
    BetweenExpression = 'BetweenExpression',
    TypeValue = 'TypeValue',
    TupleExpression = 'TupleExpression',
    WindowFrameExpression = 'WindowFrameExpression',
    SelectItem = 'SelectItem',
    SelectClause = 'SelectClause',
    DistinctOn = 'DistinctOn',
    SourceExpression = 'SourceExpression',
    FromClause = 'FromClause',
    JoinClause = 'JoinClause',
    JoinOnClause = 'JoinOnClause',
    JoinUsingClause = 'JoinUsingClause',
    FunctionSource = 'FunctionSource',
    SourceAliasExpression = 'SourceAliasExpression',
    RawString = 'RawString',
    QualifiedName = "QualifiedName",
    WhereClause = "WhereClause",
    SimpleSelectQuery = "SimpleSelectQuery",
    OrderByClause = "OrderByClause",
    GroupByClause = "GroupByClause",
    HavingClause = "HavingClause",
    SubQuerySource = "SubQuerySource",
    PartitionByClause = "PartitionByClause",
    WindowFrameClause = "WindowFrameClause",
    LimitClause = "LimitClause",
    OffsetClause = "OffsetClause",
    ForClause = "ForClause",
    WindowClause = "WindowClause",
    BinarySelectQueryOperator = "BinarySelectQueryOperator",
    Values = "Values",
    ValuesQuery = "ValuesQuery",
    WithClause = "WithClause",
    CommonTable = "CommonTable",
    WindowFrameSpec = "WindowFrameSpec",
    WindowFrameBoundStatic = "WindowFrameBoundStatic",
    WindowFrameBoundaryValue = "WindowFrameBoundaryValue",
    FetchClause = "FetchClause",
    FetchExpression = "FetchExpression",
    InsertQuery = "InsertQuery",
    InsertClause = "InsertClause",
    UpdateQuery = "UpdateQuery",
    UpdateClause = "UpdateClause",
    DeleteQuery = "DeleteQuery",
    DeleteClause = "DeleteClause",
    UsingClause = "UsingClause",
    ReturningClause = "ReturningClause",
    SetClause = "SetClause",
    SetClauseItem = "SetClauseItem",
    CreateTableQuery = "CreateTableQuery",
    CreateTableDefinition = "CreateTableDefinition",
    TableColumnDefinition = "TableColumnDefinition",
    ColumnConstraintDefinition = "ColumnConstraintDefinition",
    TableConstraintDefinition = "TableConstraintDefinition",
    ReferenceDefinition = "ReferenceDefinition",
    CreateIndexStatement = "CreateIndexStatement",
    IndexColumnList = "IndexColumnList",
    IndexColumnDefinition = "IndexColumnDefinition",
    DropTableStatement = "DropTableStatement",
    DropIndexStatement = "DropIndexStatement",
    AlterTableStatement = "AlterTableStatement",
    AlterTableAddConstraint = "AlterTableAddConstraint",
    AlterTableDropConstraint = "AlterTableDropConstraint",
    DropConstraintStatement = "DropConstraintStatement",
    MergeQuery = "MergeQuery",
    MergeWhenClause = "MergeWhenClause",
    MergeUpdateAction = "MergeUpdateAction",
    MergeDeleteAction = "MergeDeleteAction",
    MergeInsertAction = "MergeInsertAction",
    MergeDoNothingAction = "MergeDoNothingAction",
    CommentBlock = "CommentBlock", // Container for comment tokens with conditional newlines
    // Add more as needed
}

export class SqlPrintToken {
    /**
     * The type of this token, representing the general category (e.g. keyword, value, operator).
     */
    type: SqlPrintTokenType;
    /**
     * The actual text content of this token, following SQL syntax.
     */
    text: string;
    /**
     * The type of the container this token belongs to. Used for clauses, functions, or other groupings.
     */
    containerType: SqlPrintTokenContainerType;

    /**
     * Optional. Keywords that are part of this token, like DISTINCT in a SELECT clause.
     * These should typically be processed before innerTokens.
     */
    keywordTokens?: SqlPrintToken[];

    /**
     * Child tokens that belong to this container.
     */
    innerTokens: SqlPrintToken[] = [];

    /**
     * Optional marker indicating that this token originated from headerComments.
     * This flag is only valid for CommentBlock containers and used by printers
     * to selectively emit only header-level annotations.
     */
    isHeaderComment?: boolean;

    constructor(type: SqlPrintTokenType, text: string = '', containerType: SqlPrintTokenContainerType = SqlPrintTokenContainerType.None) {
        this.type = type;
        this.text = text;
        this.containerType = containerType;
    }

    markAsHeaderComment(): void {
        if (this.containerType !== SqlPrintTokenContainerType.CommentBlock) {
            throw new Error('Header comment flag must only be applied to CommentBlock containers.');
        }
        this.isHeaderComment = true;
    }
}
