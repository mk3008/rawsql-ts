// Entry point for rawsql-ts package
export * from './src/parsers/SqlParser';
export * from './src/parsers/SelectQueryParser';
export * from './src/parsers/InsertQueryParser';
export * from './src/parsers/UpdateQueryParser';
export * from './src/parsers/DeleteQueryParser';
export * from './src/parsers/WithClauseParser';
export * from './src/parsers/CreateTableParser';
export * from './src/parsers/MergeQueryParser';
export * from './src/parsers/CreateIndexParser';
export * from './src/parsers/DropTableParser';
export * from './src/parsers/DropIndexParser';
export * from './src/parsers/AlterTableParser';
export * from './src/parsers/DropConstraintParser';
export * from './src/types/Formatting';
export * from './src/models/BinarySelectQuery';
export * from './src/models/SelectQuery';
export * from './src/models/SqlComponent';
export * from './src/models/ValueComponent';
export * from './src/models/ValuesQuery';
export * from './src/models/CTEError';
export * from './src/models/Lexeme';
export * from './src/models/FormattingLexeme';
export * from './src/models/InsertQuery';
export * from './src/models/UpdateQuery';
export * from './src/models/DeleteQuery';
export * from './src/models/CreateTableQuery';
export * from './src/models/MergeQuery';
export * from './src/models/DDLStatements';
export * from './src/models/TableDefinitionModel';
export * from './src/transformers/CTECollector';
export * from './src/transformers/CTENormalizer';
export * from './src/transformers/CTEDisabler';
export * from './src/transformers/CTEDependencyAnalyzer';
export * from './src/transformers/CTETableReferenceCollector';
export * from './src/transformers/CTEQueryDecomposer';
export * from './src/transformers/CTEComposer';
export * from './src/transformers/CTERenamer';
export * from './src/transformers/AliasRenamer';
export * from './src/transformers/SmartRenamer';
export * from './src/formatters/OriginalFormatRestorer';
export * from './src/transformers/SqlIdentifierRenamer';
export * from './src/transformers/ColumnReferenceCollector';
export * from './src/transformers/Formatter';
export * from './src/transformers/SqlFormatter';
export * from './src/transformers/PostgresJsonQueryBuilder';
export * from './src/transformers/QueryBuilder'; // old name:QueryConverter
export * from './src/transformers/InsertQuerySelectValuesConverter';
export * from './src/transformers/InsertResultSelectConverter';
export * from './src/transformers/UpdateResultSelectConverter';
export * from './src/transformers/DeleteResultSelectConverter';
export * from './src/transformers/MergeResultSelectConverter';
export * from './src/transformers/SelectResultSelectConverter';
export * from './src/transformers/SimulatedSelectConverter';
export * from './src/transformers/DDLToFixtureConverter';
export * from './src/transformers/DDLGeneralizer';
export * from './src/transformers/DDLDiffGenerator';
export * from './src/transformers/SelectValueCollector';
export * from './src/transformers/SelectableColumnCollector';
export { DuplicateDetectionMode } from './src/transformers/SelectableColumnCollector';
export * from './src/transformers/FilterableItemCollector';
export { FixtureCteBuilder } from './src/transformers/FixtureCteBuilder';
export * from './src/transformers/DynamicQueryBuilder';
export * from './src/transformers/TableColumnResolver';
export * from './src/transformers/TableSourceCollector';
export * from './src/transformers/JsonMappingConverter';
export * from './src/transformers/EnhancedJsonMapping';
export { convertModelDrivenMapping, validateModelDrivenMapping } from './src/transformers/ModelDrivenJsonMapping';
export { 
/** @deprecated Use JsonMappingConverter.convert() instead */
processJsonMapping, isModelDrivenFormat, isUnifiedFormat, isLegacyFormat } from './src/transformers/JsonMappingUnifier';
/** @deprecated Use JsonMappingConverter.toLegacyMapping() instead */
export { unifyJsonMapping } from './src/transformers/JsonMappingUnifier';
export * from './src/transformers/UpstreamSelectQueryFinder';
export * from './src/transformers/TypeTransformationPostProcessor';
export * from './src/transformers/SchemaCollector';
export { TableSchema } from './src/transformers/SchemaCollector';
export * from './src/transformers/FilterableItemCollector';
export { FilterableItem } from './src/transformers/FilterableItemCollector';
export * from './src/transformers/QueryFlowDiagramGenerator';
export * from './src/transformers/SqlParamInjector';
export * from './src/transformers/SqlSortInjector';
export * from './src/transformers/SqlPaginationInjector';
export * from './src/transformers/DynamicQueryBuilder';
export * from './src/utils/SqlSchemaValidator';
export * from './src/utils/JsonSchemaValidator';
export * from './src/utils/SchemaManager';
export * from './src/utils/CommentEditor';
export * from './src/utils/LexemeCursor';
export * from './src/utils/CTERegionDetector';
// Position-aware parsing and IntelliSense support
export * from './src/utils/CursorContextAnalyzer';
export * from './src/utils/ScopeResolver';
export * from './src/utils/PositionAwareParser';
export * from './src/utils/MultiQuerySplitter';
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
getCompletionSuggestions } from './src/utils/IntelliSenseApi';
// Add more exports here if you want to expose additional public API
//# sourceMappingURL=index.js.map