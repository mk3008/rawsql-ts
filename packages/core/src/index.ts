// Entry point for rawsql-ts package
export * from './parsers/SqlParser';
export * from './parsers/SelectQueryParser';
export { ParseAnalysisResult } from './parsers/SelectQueryParser';
export * from './parsers/InsertQueryParser';
export * from './parsers/UpdateQueryParser';
export * from './parsers/DeleteQueryParser';
export * from './parsers/WithClauseParser';
export * from './parsers/CreateTableParser';
export * from './parsers/MergeQueryParser';

export * from './models/BinarySelectQuery';
export * from './models/SelectQuery';
export * from './models/SqlComponent';
export * from './models/ValueComponent';
export * from './models/ValuesQuery';
export * from './models/CTEError';
export * from './models/Lexeme';
export * from './models/FormattingLexeme';
export * from './models/InsertQuery';
export * from './models/UpdateQuery';
export * from './models/DeleteQuery';
export * from './models/CreateTableQuery';
export * from './models/MergeQuery';

export * from './transformers/CTECollector';
export * from './transformers/CTENormalizer';
export * from './transformers/CTEDisabler';
export * from './transformers/CTEDependencyAnalyzer';
export * from './transformers/CTETableReferenceCollector';
export * from './transformers/CTEQueryDecomposer';
export type { CTERestorationResult } from './transformers/CTEQueryDecomposer';
export * from './transformers/CTEComposer';
export * from './transformers/CTERenamer';
export * from './transformers/AliasRenamer';
export * from './transformers/SmartRenamer';
export * from './formatters/OriginalFormatRestorer';
export * from './transformers/SqlIdentifierRenamer';
export type { ScopeRange } from './transformers/SqlIdentifierRenamer';
export * from './transformers/ColumnReferenceCollector';
export * from './transformers/Formatter';
export * from './transformers/SqlFormatter';
export * from './transformers/PostgresJsonQueryBuilder';
export * from './transformers/QueryBuilder'; // old name:QueryConverter
export * from './transformers/InsertQuerySelectValuesConverter';
export * from './transformers/SelectValueCollector';
export * from './transformers/SelectableColumnCollector';
export { DuplicateDetectionMode } from './transformers/SelectableColumnCollector';
export * from './transformers/FilterableItemCollector';
export * from './transformers/DynamicQueryBuilder';
export * from './transformers/TableColumnResolver';
export * from './transformers/TableSourceCollector';
export * from './transformers/JsonMappingConverter';
export * from './transformers/EnhancedJsonMapping';
export {
    ModelDrivenJsonMapping,
    convertModelDrivenMapping,
    validateModelDrivenMapping,
    FieldMapping,
    NestedStructure,
    StructureFields,
    FieldType
} from './transformers/ModelDrivenJsonMapping';
export {
    /** @deprecated Use JsonMappingConverter.convert() instead */
    processJsonMapping,
    isModelDrivenFormat,
    isUnifiedFormat,
    isLegacyFormat
} from './transformers/JsonMappingUnifier';

/** @deprecated Use JsonMappingConverter.toLegacyMapping() instead */
export { unifyJsonMapping } from './transformers/JsonMappingUnifier';
export * from './transformers/UpstreamSelectQueryFinder';
export * from './transformers/TypeTransformationPostProcessor';

export * from './transformers/SchemaCollector';
export { TableSchema, SchemaAnalysisResult } from './transformers/SchemaCollector';
export * from './transformers/FilterableItemCollector';
export { FilterableItem, FilterableItemCollectorOptions } from './transformers/FilterableItemCollector';
export * from './transformers/QueryFlowDiagramGenerator';
export * from './transformers/SqlParamInjector';
export * from './transformers/SqlSortInjector';
export * from './transformers/SqlPaginationInjector';
export * from './transformers/DynamicQueryBuilder';

export * from './utils/SqlSchemaValidator';
export * from './utils/JsonSchemaValidator';
export * from './utils/SchemaManager';
export * from './utils/CommentEditor';
export * from './utils/LexemeCursor';
export type { LineColumn } from './utils/LexemeCursor';
export * from './utils/CTERegionDetector';
export type { CTERegion, CursorPositionInfo } from './utils/CTERegionDetector';

// Position-aware parsing and IntelliSense support
export * from './utils/CursorContextAnalyzer';
export type { IntelliSenseContext } from './utils/CursorContextAnalyzer';
export * from './utils/ScopeResolver';
export type { 
    ScopeInfo, 
    AvailableTable, 
    AvailableCTE, 
    AvailableColumn 
} from './utils/ScopeResolver';
export * from './utils/PositionAwareParser';
export type { 
    ParseToPositionOptions, 
    PositionParseResult 
} from './utils/PositionAwareParser';
export * from './utils/MultiQuerySplitter';
export type { QueryInfo, QueryCollection } from './utils/MultiQuerySplitter';

// Convenience functions for IntelliSense integration
export {
    /** Parse SQL up to cursor position with error recovery */
    parseToPosition,
    /** Analyze cursor context for IntelliSense */
    getCursorContext,
    /** Resolve scope information at cursor position */
    resolveScope,
    /** Split multi-query SQL text into individual queries */
    splitQueries,
    /** Get IntelliSense information for multi-query context */
    getIntelliSenseInfo,
    /** Get completion suggestions based on cursor context */
    getCompletionSuggestions
} from './utils/IntelliSenseApi';


// Add more exports here if you want to expose additional public API
