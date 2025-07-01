import { SqlComponent } from '../models/SqlComponent';

/**
 * Utility class for editing comments on SQL components.
 * Provides functions to add, edit, delete, and search comments in SQL AST.
 */
export class CommentEditor {
    /**
     * Add a comment to a SQL component
     * @param component The SQL component to add comment to
     * @param comment The comment text to add
     */
    static addComment(component: SqlComponent, comment: string): void {
        if (!component.comments) {
            component.comments = [];
        }
        component.comments.push(comment);
    }

    /**
     * Edit an existing comment by index
     * @param component The SQL component containing the comment
     * @param index The index of the comment to edit (0-based)
     * @param newComment The new comment text
     * @throws Error if index is invalid
     */
    static editComment(component: SqlComponent, index: number, newComment: string): void {
        if (!component.comments || index < 0 || index >= component.comments.length) {
            throw new Error(`Invalid comment index: ${index}. Component has ${component.comments?.length || 0} comments.`);
        }
        component.comments[index] = newComment;
    }

    /**
     * Delete a comment by index
     * @param component The SQL component containing the comment
     * @param index The index of the comment to delete (0-based)
     * @throws Error if index is invalid
     */
    static deleteComment(component: SqlComponent, index: number): void {
        if (!component.comments || index < 0 || index >= component.comments.length) {
            throw new Error(`Invalid comment index: ${index}. Component has ${component.comments?.length || 0} comments.`);
        }
        component.comments.splice(index, 1);
        if (component.comments.length === 0) {
            component.comments = null;
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
     * @param component The SQL component to get comments from
     * @returns Array of comment strings (empty array if no comments)
     */
    static getComments(component: SqlComponent): string[] {
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
                if (component.comments && component.comments.some(c => {
                    const commentText = caseSensitive ? c : c.toLowerCase();
                    return commentText.includes(searchTerm);
                })) {
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
            if (component && component instanceof SqlComponent && component.comments) {
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
            if (component && component instanceof SqlComponent && component.comments) {
                count += component.comments.length;
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
            if (component && component instanceof SqlComponent && component.comments) {
                component.comments.forEach((comment, index) => {
                    results.push({ comment, component, index });
                });
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