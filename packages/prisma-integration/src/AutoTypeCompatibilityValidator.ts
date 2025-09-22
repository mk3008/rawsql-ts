/**
 * Automatic Type Compatibility Validator
 * 
 * Uses TypeScript compiler API to automatically validate JsonMapping compatibility
 * with target TypeScript interfaces. Only requires interface name and import path!
 */

import * as ts from 'typescript';
import * as fs from 'fs';
import * as path from 'path';
import { EnhancedJsonMapping, TypeValidationResult } from './EnhancedJsonMapping';

/**
 * Supported TypeScript file extensions for interface resolution
 */
const TYPESCRIPT_EXTENSIONS = ['.ts', '.tsx', '.d.ts'] as const;

export interface AutoTypeValidationOptions {
    /**
     * Base directory for resolving relative import paths
     */
    baseDir?: string;

    /**
     * TypeScript compiler options
     */
    compilerOptions?: ts.CompilerOptions;

    /**
     * Enable debug logging
     */
    debug?: boolean;
}

/**
 * Automatic type compatibility validator that reads TypeScript interfaces
 * and validates JsonMapping structure compatibility
 */
export class AutoTypeCompatibilityValidator {
    private options: AutoTypeValidationOptions;

    constructor(options: AutoTypeValidationOptions = {}) {
        // Use project current directory for proper path resolution
        const defaultBaseDir = process.cwd();
        
        this.options = {
            baseDir: defaultBaseDir,
            compilerOptions: {
                target: ts.ScriptTarget.ES2020,
                module: ts.ModuleKind.CommonJS,
                moduleResolution: ts.ModuleResolutionKind.NodeJs,
                esModuleInterop: true,
                allowSyntheticDefaultImports: true,
                strict: true,
                skipLibCheck: true
            },
            debug: false,
            ...options
        };
    }

    /**
     * Validate JsonMapping compatibility with TypeScript interface
     * 
     * @param jsonMapping - Enhanced JsonMapping with typeInfo
     * @returns Validation result with detailed compatibility information
     */
    public async validateMapping(jsonMapping: EnhancedJsonMapping): Promise<TypeValidationResult> {
        if (!jsonMapping.typeInfo) {
            return {
                isValid: false,
                errors: ['No type information provided in JsonMapping'],
                missingProperties: [],
                extraProperties: [],
                typeConflicts: []
            };
        }

        try {
            // Resolve the interface file path
            const interfaceFilePath = this.resolveInterfacePath(jsonMapping.typeInfo.importPath);

            if (this.options.debug) {
                console.log(`🔍 Import path: ${jsonMapping.typeInfo.importPath}`);
                console.log(`📂 Base directory: ${this.options.baseDir}`);
                console.log(`📄 Resolved to: ${interfaceFilePath}`);
                console.log(`✅ File exists: ${fs.existsSync(interfaceFilePath)}`);
            }

            // Parse TypeScript interface
            const interfaceStructure = await this.parseInterface(
                interfaceFilePath,
                jsonMapping.typeInfo.interface
            );

            if (this.options.debug) {
                console.log(`📋 Parsed interface structure:`, JSON.stringify(interfaceStructure, null, 2));
            }

            // Generate expected structure from JsonMapping
            const mappingStructure = this.generateStructureFromMapping(jsonMapping);

            if (this.options.debug) {
                console.log(`🏗️  Generated mapping structure:`, JSON.stringify(mappingStructure, null, 2));
            }

            // Compare structures
            const validationResult = this.compareStructures(interfaceStructure, mappingStructure);

            if (this.options.debug) {
                console.log(`✅ Validation result:`, validationResult);
            }

            return validationResult;

        } catch (error) {
            return {
                isValid: false,
                errors: [`Failed to validate interface: ${error instanceof Error ? error.message : String(error)}`],
                missingProperties: [],
                extraProperties: [],
                typeConflicts: []
            };
        }
    }

    /**
     * Resolve interface file path relative to base directory
     */
    private resolveInterfacePath(importPath: string): string {
        if (path.isAbsolute(importPath)) {
            return importPath;
        }

        // Try different resolution strategies
        const candidatePaths = this.generateCandidatePaths(importPath);
        
        // Find the first existing file
        for (const candidatePath of candidatePaths) {
            const resolvedPath = this.resolveWithExtensions(candidatePath);
            if (resolvedPath) {
                return resolvedPath;
            }
        }

        // Fallback: return original resolution and append .ts only when needed
        const fallbackPath = path.resolve(this.options.baseDir!, importPath);
        return path.extname(fallbackPath) ? fallbackPath : `${fallbackPath}.ts`;
    }

    /**
     * Generate candidate paths for resolution, handling redundant directory prefixes
     * 
     * This method addresses the issue where import paths may contain redundant directory names
     * that match the base directory name. For example:
     * - baseDir: "/project/static-analysis"
     * - importPath: "static-analysis/src/types.ts"
     * - Result: First tries "/project/static-analysis/src/types.ts", then "/project/static-analysis/static-analysis/src/types.ts"
     * 
     * @param importPath - The relative import path from the JSON mapping file
     * @returns Array of candidate absolute paths to try, ordered by preference
     */
    private generateCandidatePaths(importPath: string): string[] {
        const baseDir = this.options.baseDir!;
        const baseDirName = path.basename(baseDir);
        const normalizedImportPath = importPath.split('\\').join('/');
        const normalizedSegments = normalizedImportPath.split('/').filter(segment => segment.length > 0);
        const candidates: string[] = [];

        const addCandidate = (segments: string[]) => {
            const candidate = path.resolve(baseDir, ...segments);
            if (!candidates.includes(candidate)) {
                candidates.push(candidate);
            }
        };

        let prefixIndex = 0;
        while (prefixIndex < normalizedSegments.length && normalizedSegments[prefixIndex] === baseDirName) {
            prefixIndex++;
            addCandidate(normalizedSegments.slice(prefixIndex));
        }

        addCandidate(normalizedSegments);

        const resolvedOriginal = path.resolve(baseDir, normalizedImportPath);
        if (!candidates.includes(resolvedOriginal)) {
            candidates.push(resolvedOriginal);
        }

        return candidates;
    }

    /**
     * Try to resolve a path with common TypeScript extensions
     * 
     * @param basePath - The base path to resolve (with or without extension)
     * @returns The resolved path if found, null otherwise
     */
    private resolveWithExtensions(basePath: string): string | null {
        // If path already has an extension, check if it exists
        if (path.extname(basePath)) {
            return fs.existsSync(basePath) ? basePath : null;
        }

        // Try common TypeScript file extensions
        for (const ext of TYPESCRIPT_EXTENSIONS) {
            const withExt = basePath + ext;
            if (fs.existsSync(withExt)) {
                return withExt;
            }
        }

        return null;
    }

    /**
     * Parse TypeScript interface and extract structure
     */
    private async parseInterface(filePath: string, interfaceName: string): Promise<any> {
        const sourceCode = fs.readFileSync(filePath, 'utf8');
        const sourceFile = ts.createSourceFile(
            filePath,
            sourceCode,
            ts.ScriptTarget.Latest,
            true
        );

        let interfaceDeclaration: ts.InterfaceDeclaration | undefined;

        // Find the target interface
        ts.forEachChild(sourceFile, (node) => {
            if (ts.isInterfaceDeclaration(node) && node.name.text === interfaceName) {
                interfaceDeclaration = node;
            }
        });

        if (!interfaceDeclaration) {
            throw new Error(`Interface ${interfaceName} not found in ${filePath}`);
        }

        // Extract interface structure
        return this.extractInterfaceStructure(interfaceDeclaration);
    }

    /**
     * Extract structure from TypeScript interface declaration
     */
    private extractInterfaceStructure(interfaceDecl: ts.InterfaceDeclaration): any {
        const structure: any = {};

        for (const member of interfaceDecl.members) {
            if (ts.isPropertySignature(member) && member.name && ts.isIdentifier(member.name)) {
                const propertyName = member.name.text;
                const isOptional = !!member.questionToken;
                const typeInfo = this.extractTypeInfo(member.type);

                structure[propertyName] = {
                    required: !isOptional,
                    type: typeInfo
                };
            }
        }

        return structure;
    }

    /**
     * Extract type information from TypeScript type node
     */
    private extractTypeInfo(typeNode: ts.TypeNode | undefined): string {
        if (!typeNode) return 'unknown';

        switch (typeNode.kind) {
            case ts.SyntaxKind.StringKeyword:
                return 'string';
            case ts.SyntaxKind.NumberKeyword:
                return 'number';
            case ts.SyntaxKind.BooleanKeyword:
                return 'boolean';
            case ts.SyntaxKind.ArrayType:
                const arrayType = typeNode as ts.ArrayTypeNode;
                const elementType = this.extractTypeInfo(arrayType.elementType);
                return `${elementType}[]`;
            case ts.SyntaxKind.TypeReference:
                const typeRef = typeNode as ts.TypeReferenceNode;
                if (ts.isIdentifier(typeRef.typeName)) {
                    const typeName = typeRef.typeName.text;
                    if (typeName === 'Date') return 'Date';
                    return 'object'; // Assume other type references are objects
                }
                return 'object';
            default:
                return 'unknown';
        }
    }

    /**
     * Generate expected structure from JsonMapping
     */
    private generateStructureFromMapping(mapping: EnhancedJsonMapping): any {
        const structure: any = {};        // Add root entity properties
        for (const [jsonKey, sqlColumn] of Object.entries(mapping.rootEntity.columns)) {
            structure[jsonKey] = {
                required: true, // Assume required unless specified otherwise
                type: this.inferTypeFromColumnName(String(sqlColumn))
            };
        }

        // Add nested entities
        for (const nestedEntity of mapping.nestedEntities) {
            if (nestedEntity.relationshipType === 'array') {
                structure[nestedEntity.propertyName] = {
                    required: true,
                    type: 'object[]'
                };
            } else {
                structure[nestedEntity.propertyName] = {
                    required: true,
                    type: 'object'
                };
            }
        }

        return structure;
    }

    /**
     * Infer TypeScript type from SQL column name (basic heuristics)
     */
    private inferTypeFromColumnName(columnName: string): string {
        const name = columnName.toLowerCase();

        if (name.includes('id') || name.includes('count')) return 'number';
        if (name.includes('created_at') || name.includes('updated_at') || name.includes('date')) return 'Date';
        if (name.includes('completed') || name.includes('is_') || name.includes('has_')) return 'boolean';

        return 'string'; // Default to string
    }    /**
     * Compare interface structure with mapping structure (structure-only validation)
     */
    private compareStructures(interfaceStructure: any, mappingStructure: any): TypeValidationResult {
        const errors: string[] = [];
        const missingProperties: string[] = [];
        const extraProperties: string[] = [];
        const typeConflicts: Array<{ property: string; expected: string; actual: string }> = [];

        // Check for missing required properties (property names only)
        for (const [prop, info] of Object.entries(interfaceStructure)) {
            const propInfo = info as any;
            if (propInfo.required && !mappingStructure[prop]) {
                missingProperties.push(prop);
            }
        }

        // Check for extra properties (ignore type conflicts for structure-only validation)
        for (const [prop, info] of Object.entries(mappingStructure)) {
            if (!interfaceStructure[prop]) {
                extraProperties.push(prop);
            }
            // Skip type comparison - structure-only validation
        }

        // Generate error messages (only for missing/extra properties)
        if (missingProperties.length > 0) {
            errors.push(`Missing required properties: ${missingProperties.join(', ')}`);
        }
        if (extraProperties.length > 0) {
            errors.push(`Extra properties not in interface: ${extraProperties.join(', ')}`);
        } return {
            isValid: errors.length === 0,
            errors,
            missingProperties,
            extraProperties,
            typeConflicts: [] // Always empty for structure-only validation
        };
    }
}
