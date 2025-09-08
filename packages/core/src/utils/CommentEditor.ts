import { SqlComponent } from '../models/SqlComponent';
import { SelectQuery } from '../models/SelectQuery';

/**
 * Utility class for editing comments on SQL components.
 * Provides functions to add, edit, delete, and search comments in SQL AST.
 */
export class CommentEditor {
    /**
     * Add a comment to a SQL component
     * For SelectQuery components, adds to headerComments for query-level comments
     * @param component The SQL component to add comment to
     * @param comment The comment text to add
     */
    static addComment(component: SqlComponent, comment: string): void {
        // Check if this is a SelectQuery component - add to headerComments for query-level comments
        if (this.isSelectQuery(component)) {
            const selectQuery = component as SelectQuery;
            if (!selectQuery.headerComments) {
                selectQuery.headerComments = [];
            }
            selectQuery.headerComments.push(comment);
        } else {
            // For other components, add to regular comments
            if (!component.comments) {
                component.comments = [];
            }
            component.comments.push(comment);
        }
    }
    
    /**
     * Check if a component implements SelectQuery interface
     * Uses multiple checks for robust type detection
     * @param component The component to check
     * @returns true if the component is a SelectQuery
     */
    private static isSelectQuery(component: SqlComponent): component is SelectQuery {
        // First check for required properties
        const hasRequiredProperties = 'headerComments' in component && 
                                    'setParameter' in component && 
                                    'toSimpleQuery' in component;
        
        // Additional check for method types to increase robustness
        if (hasRequiredProperties) {
            const candidate = component as any;
            return typeof candidate.setParameter === 'function' && 
                   typeof candidate.toSimpleQuery === 'function';
        }
        
        return false;
    }

    /**
     * Edit an existing comment by index
     * For SelectQuery components, edits headerComments
     * @param component The SQL component containing the comment
     * @param index The index of the comment to edit (0-based)
     * @param newComment The new comment text
     * @throws Error if index is invalid
     */
    static editComment(component: SqlComponent, index: number, newComment: string): void {
        if (this.isSelectQuery(component)) {
            const selectQuery = component as SelectQuery;
            if (!selectQuery.headerComments || index < 0 || index >= selectQuery.headerComments.length) {
                throw new Error(`Invalid comment index: ${index}. Component has ${selectQuery.headerComments?.length || 0} comments.`);
            }
            selectQuery.headerComments[index] = newComment;
        } else {
            if (!component.comments || index < 0 || index >= component.comments.length) {
                throw new Error(`Invalid comment index: ${index}. Component has ${component.comments?.length || 0} comments.`);
            }
            component.comments[index] = newComment;
        }
    }

    /**
     * Delete a comment by index
     * For SelectQuery components, deletes from headerComments
     * @param component The SQL component containing the comment
     * @param index The index of the comment to delete (0-based)
     * @throws Error if index is invalid
     */
    static deleteComment(component: SqlComponent, index: number): void {
        if (this.isSelectQuery(component)) {
            const selectQuery = component as SelectQuery;
            if (!selectQuery.headerComments || index < 0 || index >= selectQuery.headerComments.length) {
                throw new Error(`Invalid comment index: ${index}. Component has ${selectQuery.headerComments?.length || 0} comments.`);
            }
            selectQuery.headerComments.splice(index, 1);
            if (selectQuery.headerComments.length === 0) {
                selectQuery.headerComments = null;
            }
        } else {
            if (!component.comments || index < 0 || index >= component.comments.length) {
                throw new Error(`Invalid comment index: ${index}. Component has ${component.comments?.length || 0} comments.`);
            }
            component.comments.splice(index, 1);
            if (component.comments.length === 0) {
                component.comments = null;
            }
        }
    }

    /**
     * Delete all comments from a component
     * @param component The SQL component to clear comments from
     */
    static deleteAllComments(component: SqlComponent): void {
        component.comments = null;
    }

    /**
     * Get all comments from a component
     * For SelectQuery components, returns headerComments instead of regular comments
     * @param component The SQL component to get comments from
     * @returns Array of comment strings (empty array if no comments)
     */
    static getComments(component: SqlComponent): string[] {
        if (this.isSelectQuery(component)) {
            const selectQuery = component as SelectQuery;
            return selectQuery.headerComments || [];
        }
        return component.comments || [];
    }

    /**
     * Find all components in the AST that have comments containing the search text
     * @param root The root SQL component to search from
     * @param searchText The text to search for in comments
     * @param caseSensitive Whether the search should be case-sensitive (default: false)
     * @returns Array of components that have matching comments
     */
    static findComponentsWithComment(root: SqlComponent, searchText: string, caseSensitive: boolean = false): SqlComponent[] {
        const results: SqlComponent[] = [];
        const searchTerm = caseSensitive ? searchText : searchText.toLowerCase();
        
        const traverse = (component: any) => {
            if (component && component instanceof SqlComponent) {
                let hasMatchingComment = false;
                
                // Check regular comments
                if (component.comments && component.comments.some(c => {
                    const commentText = caseSensitive ? c : c.toLowerCase();
                    return commentText.includes(searchTerm);
                })) {
                    hasMatchingComment = true;
                }
                
                // Check headerComments for SelectQuery components
                if (this.isSelectQuery(component)) {
                    const selectQuery = component as SelectQuery;
                    if (selectQuery.headerComments && selectQuery.headerComments.some(c => {
                        const commentText = caseSensitive ? c : c.toLowerCase();
                        return commentText.includes(searchTerm);
                    })) {
                        hasMatchingComment = true;
                    }
                }
                
                if (hasMatchingComment) {
                    results.push(component);
                }
            }
            
            // Traverse all properties recursively
            for (const key in component) {
                if (component[key] && typeof component[key] === 'object') {
                    if (Array.isArray(component[key])) {
                        component[key].forEach(traverse);
                    } else {
                        traverse(component[key]);
                    }
                }
            }
        };
        
        traverse(root);
        return results;
    }

    /**
     * Replace all occurrences of a text in comments across the entire AST
     * @param root The root SQL component to search and replace in
     * @param searchText The text to search for
     * @param replaceText The text to replace with
     * @param caseSensitive Whether the search should be case-sensitive (default: false)
     * @returns Number of replacements made
     */
    static replaceInComments(root: SqlComponent, searchText: string, replaceText: string, caseSensitive: boolean = false): number {
        let replacementCount = 0;
        
        const traverse = (component: any) => {
            if (component && component instanceof SqlComponent) {
                // Handle regular comments
                if (component.comments) {
                    for (let i = 0; i < component.comments.length; i++) {
                        const originalComment = component.comments[i];
                        const flags = caseSensitive ? 'g' : 'gi';
                        const regex = new RegExp(searchText.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), flags);
                        const newComment = originalComment.replace(regex, replaceText);
                        
                        if (newComment !== originalComment) {
                            component.comments[i] = newComment;
                            replacementCount++;
                        }
                    }
                }
                
                // Handle headerComments for SelectQuery components
                if (this.isSelectQuery(component)) {
                    const selectQuery = component as SelectQuery;
                    if (selectQuery.headerComments) {
                        for (let i = 0; i < selectQuery.headerComments.length; i++) {
                            const originalComment = selectQuery.headerComments[i];
                            const flags = caseSensitive ? 'g' : 'gi';
                            const regex = new RegExp(searchText.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), flags);
                            const newComment = originalComment.replace(regex, replaceText);
                            
                            if (newComment !== originalComment) {
                                selectQuery.headerComments[i] = newComment;
                                replacementCount++;
                            }
                        }
                    }
                }
            }
            
            // Traverse all properties recursively
            for (const key in component) {
                if (component[key] && typeof component[key] === 'object') {
                    if (Array.isArray(component[key])) {
                        component[key].forEach(traverse);
                    } else {
                        traverse(component[key]);
                    }
                }
            }
        };
        
        traverse(root);
        return replacementCount;
    }

    /**
     * Count total number of comments in the AST
     * @param root The root SQL component to count comments in
     * @returns Total number of comments
     */
    static countComments(root: SqlComponent): number {
        let count = 0;
        
        const traverse = (component: any) => {
            if (component && component instanceof SqlComponent) {
                if (component.comments) {
                    count += component.comments.length;
                }
                
                // Count headerComments for SelectQuery components
                if (this.isSelectQuery(component)) {
                    const selectQuery = component as SelectQuery;
                    if (selectQuery.headerComments) {
                        count += selectQuery.headerComments.length;
                    }
                }
            }
            
            // Traverse all properties recursively
            for (const key in component) {
                if (component[key] && typeof component[key] === 'object') {
                    if (Array.isArray(component[key])) {
                        component[key].forEach(traverse);
                    } else {
                        traverse(component[key]);
                    }
                }
            }
        };
        
        traverse(root);
        return count;
    }

    /**
     * Get all comments from the entire AST as a flat array with their source components
     * @param root The root SQL component to extract comments from
     * @returns Array of objects containing comment text and the component they belong to
     */
    static getAllComments(root: SqlComponent): { comment: string; component: SqlComponent; index: number }[] {
        const results: { comment: string; component: SqlComponent; index: number }[] = [];
        
        const traverse = (component: any) => {
            if (component && component instanceof SqlComponent) {
                // Add regular comments
                if (component.comments) {
                    component.comments.forEach((comment, index) => {
                        results.push({ comment, component, index });
                    });
                }
                
                // Add headerComments for SelectQuery components
                if (this.isSelectQuery(component)) {
                    const selectQuery = component as SelectQuery;
                    if (selectQuery.headerComments) {
                        selectQuery.headerComments.forEach((comment, index) => {
                            results.push({ comment, component, index });
                        });
                    }
                }
            }
            
            // Traverse all properties recursively
            for (const key in component) {
                if (component[key] && typeof component[key] === 'object') {
                    if (Array.isArray(component[key])) {
                        component[key].forEach(traverse);
                    } else {
                        traverse(component[key]);
                    }
                }
            }
        };
        
        traverse(root);
        return results;
    }
}