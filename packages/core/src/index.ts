// Entry point for rawsql-ts package
export * from './parsers/SelectQueryParser';
export * from './parsers/InsertQueryParser';

export * from './models/BinarySelectQuery';
export * from './models/SelectQuery';
export * from './models/ValueComponent';
export * from './models/ValuesQuery';
export * from './models/CTEError';

export * from './transformers/CTECollector';
export * from './transformers/CTENormalizer';
export * from './transformers/CTEDependencyAnalyzer';
export * from './transformers/Formatter';
export * from './transformers/SqlFormatter';
export * from './transformers/PostgresJsonQueryBuilder';
export * from './transformers/QueryBuilder'; // old name:QueryConverter
export * from './transformers/SelectValueCollector';
export * from './transformers/SelectableColumnCollector';
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
export * from './transformers/QueryFlowDiagramGenerator';
export * from './transformers/SqlParamInjector';
export * from './transformers/SqlSortInjector';
export * from './transformers/SqlPaginationInjector';
export * from './transformers/DynamicQueryBuilder';

export * from './utils/SqlSchemaValidator';
export * from './utils/JsonSchemaValidator';
export * from './utils/SchemaManager';
export * from './utils/CommentEditor';


// Add more exports here if you want to expose additional public API
