/**
 * Automatic Type Compatibility Validator
 * 
 * Uses TypeScript compiler API to automatically validate JsonMapping compatibility
 * with target TypeScript interfaces. Only requires interface name and import path!
 */

import * as ts from 'typescript';
import * as fs from 'fs';
import * as path from 'path';
import { EnhancedJsonMapping, TypeValidationResult } from './types/EnhancedJsonMapping';

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
        this.options = {
            baseDir: process.cwd(),
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
                console.log(`🔍 Resolving interface from: ${interfaceFilePath}`);
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
     */    private resolveInterfacePath(importPath: string): string {
        if (path.isAbsolute(importPath)) {
            return importPath;
        }

        const resolved = path.resolve(this.options.baseDir!, importPath);

        // If already has an extension, return as-is
        if (path.extname(resolved)) {
            if (fs.existsSync(resolved)) {
                return resolved;
            }
        }

        // Try common TypeScript file extensions
        const extensions = ['.ts', '.tsx', '.d.ts'];
        for (const ext of extensions) {
            const withExt = resolved + ext;
            if (fs.existsSync(withExt)) {
                return withExt;
            }
        }

        // If no extension found, return with .ts as fallback
        return resolved + '.ts';
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