import { BinarySelectQuery, SelectQuery, SimpleSelectQuery, ValuesQuery } from "../models/SelectQuery";
import { CommonTable, SelectClause, SelectItem, SourceAliasExpression, WithClause } from "../models/Clause";
import { SqlComponent, PositionedComment } from "../models/SqlComponent";

/**
 * Source span for a comment when parser metadata is available.
 *
 * @remarks The current parser stores comment text on AST nodes but does not
 * retain reliable per-comment source spans, so extractors usually omit this.
 */
export interface AstCommentSourceRange {
    start: number;
    end: number;
}

/**
 * Conservatively describes where an AST comment fact appears relative to syntax.
 */
export type AstCommentPlacement = "leading" | "trailing" | "inner" | "detached";

/**
 * Generic comment fact extracted from SQL AST comment metadata.
 *
 * @remarks `targetNode` is optional because SQL comments do not always have a
 * strict syntactic owner. Ambiguous legacy buckets are emitted as detached.
 */
export interface AstCommentAttachment {
    text: string;
    sourceOrder: number;
    placement: AstCommentPlacement;
    targetNode?: SqlComponent;
    range?: AstCommentSourceRange;
}

/**
 * Extracts comment attachment facts already represented in the SQL AST.
 *
 * @remarks This API does not infer product-specific meanings or rewrite
 * comments. It returns a deterministic flat list without mutating the input AST.
 */
export class AstCommentAttachmentExtractor {
    private readonly attachments: AstCommentAttachment[] = [];
    private readonly visited = new Set<object>();
    private readonly suppressedDetachedCommentArrays = new WeakSet<string[]>();

    /**
     * Extract comment attachment facts from a SQL AST component.
     */
    public static extract(input: SqlComponent | null | undefined): AstCommentAttachment[] {
        if (!input) {
            return [];
        }

        const extractor = new AstCommentAttachmentExtractor();
        extractor.visit(input);
        return extractor.attachments;
    }

    private visit(value: unknown): void {
        if (!value || typeof value !== "object") {
            return;
        }

        if (this.visited.has(value)) {
            return;
        }
        this.visited.add(value);

        if (Array.isArray(value)) {
            for (const item of value) {
                this.visit(item);
            }
            return;
        }

        if (value instanceof SqlComponent) {
            this.visitSqlComponent(value);
            return;
        }
    }

    private visitSqlComponent(component: SqlComponent): void {
        this.emitHeaderComments(component);
        this.emitPositionedComments(component, "before");
        if (!(component instanceof SimpleSelectQuery)) {
            this.emitLegacyComments(component);
        }

        if (component instanceof SelectItem) {
            this.emitPositionedComments(component, "after");
            this.emitSelectItemKeywordComments(component);
            this.visit(component.value);
            this.visit(component.identifier);
            return;
        }

        if (component instanceof CommonTable) {
            this.visit(component.aliasExpression);
            this.visit(component.query);
            this.emitPositionedComments(component, "after");
            return;
        }

        if (component instanceof WithClause) {
            this.visit(component.tables);
            this.emitDetachedComments(component.trailingComments);
            this.emitDetachedComments(component.globalComments);
            this.emitPositionedComments(component, "after");
            return;
        }

        if (component instanceof SimpleSelectQuery) {
            this.suppressWithClauseTrailingCommentsAlreadyCopiedToQuery(component);
            this.visit(component.withClause);
            this.emitLegacyComments(component);
            this.visit(component.selectClause);
            this.visit(component.fromClause);
            this.visit(component.whereClause);
            this.visit(component.groupByClause);
            this.visit(component.havingClause);
            this.visit(component.windowClause);
            this.visit(component.orderByClause);
            this.visit(component.limitClause);
            this.visit(component.offsetClause);
            this.visit(component.fetchClause);
            this.visit(component.forClause);
            this.emitPositionedComments(component, "after");
            return;
        }

        if (component instanceof BinarySelectQuery) {
            this.visit(component.left);
            this.visit(component.right);
            this.emitPositionedComments(component, "after");
            return;
        }

        if (component instanceof ValuesQuery) {
            this.visit(component.withClause);
            this.visit(component.tuples);
            this.emitPositionedComments(component, "after");
            return;
        }

        if (component instanceof SelectClause) {
            this.visit(component.distinct);
            this.visit(component.hints);
            this.visit(component.items);
            this.emitPositionedComments(component, "after");
            return;
        }

        if (component instanceof SourceAliasExpression) {
            this.visit(component.table);
            this.visit(component.columns);
            this.emitPositionedComments(component, "after");
            return;
        }

        this.visitFallbackProperties(component);
        this.emitPositionedComments(component, "after");
    }

    private visitFallbackProperties(component: SqlComponent): void {
        for (const key of Object.keys(component)) {
            if (this.shouldSkipProperty(key)) {
                continue;
            }
            this.visit((component as unknown as Record<string, unknown>)[key]);
        }
    }

    private shouldSkipProperty(key: string): boolean {
        return key === "comments" ||
            key === "positionedComments" ||
            key === "headerComments" ||
            key === "trailingComments" ||
            key === "globalComments" ||
            key === "asKeywordPositionedComments" ||
            key === "asKeywordComments" ||
            key === "aliasPositionedComments" ||
            key === "aliasComments" ||
            key === "cteNameCache";
    }

    private emitHeaderComments(component: SqlComponent): void {
        if (!this.isSelectQuery(component)) {
            return;
        }

        this.emitComments(component.headerComments, "leading", component);
    }

    private emitLegacyComments(component: SqlComponent): void {
        this.emitComments(component.comments, "detached");
    }

    private emitPositionedComments(component: SqlComponent, position: PositionedComment["position"]): void {
        if (!component.positionedComments) {
            return;
        }

        for (const positionedComment of component.positionedComments) {
            if (positionedComment.position !== position) {
                continue;
            }
            this.emitComments(
                positionedComment.comments,
                position === "before" ? "leading" : "trailing",
                component
            );
        }
    }

    private emitSelectItemKeywordComments(selectItem: SelectItem): void {
        const itemWithCommentFields = selectItem as SelectItem & {
            asKeywordPositionedComments?: PositionedComment[];
            asKeywordComments?: string[] | null;
            aliasPositionedComments?: PositionedComment[];
            aliasComments?: string[] | null;
        };

        this.emitKeywordPositionedComments(itemWithCommentFields.asKeywordPositionedComments, selectItem, "inner");
        this.emitComments(itemWithCommentFields.asKeywordComments, "inner", selectItem);
        this.emitKeywordPositionedComments(itemWithCommentFields.aliasPositionedComments, selectItem);
        this.emitComments(itemWithCommentFields.aliasComments, "trailing", selectItem);
    }

    private emitKeywordPositionedComments(
        positionedComments: PositionedComment[] | undefined,
        targetNode: SqlComponent,
        placementOverride?: AstCommentPlacement
    ): void {
        if (!positionedComments) {
            return;
        }

        for (const positionedComment of positionedComments) {
            const placement = placementOverride ??
                (positionedComment.position === "before" ? "leading" : "trailing");
            this.emitComments(positionedComment.comments, placement, targetNode);
        }
    }

    private emitDetachedComments(comments: string[] | null | undefined): void {
        if (comments && this.suppressedDetachedCommentArrays.has(comments)) {
            return;
        }
        this.emitComments(comments, "detached");
    }

    private emitComments(
        comments: string[] | null | undefined,
        placement: AstCommentPlacement,
        targetNode?: SqlComponent
    ): void {
        if (!comments) {
            return;
        }

        for (const text of comments) {
            this.attachments.push({
                text,
                sourceOrder: this.attachments.length,
                placement,
                ...(targetNode ? { targetNode } : {})
            });
        }
    }

    private isSelectQuery(component: SqlComponent): component is SelectQuery {
        return "__selectQueryType" in component &&
            (component as SelectQuery).__selectQueryType === "SelectQuery";
    }

    private suppressWithClauseTrailingCommentsAlreadyCopiedToQuery(query: SimpleSelectQuery): void {
        const trailingComments = query.withClause?.trailingComments;
        if (!trailingComments || !query.comments) {
            return;
        }

        if (this.containsCommentSequence(query.comments, trailingComments)) {
            this.suppressedDetachedCommentArrays.add(trailingComments);
        }
    }

    private containsCommentSequence(source: string[], candidate: string[]): boolean {
        if (candidate.length === 0) {
            return true;
        }

        for (let start = 0; start <= source.length - candidate.length; start++) {
            const matches = candidate.every((comment, index) => source[start + index] === comment);
            if (matches) {
                return true;
            }
        }

        return false;
    }
}

/**
 * Extract comment attachment facts from a SQL AST component.
 */
export function extractAstCommentAttachments(input: SqlComponent | null | undefined): AstCommentAttachment[] {
    return AstCommentAttachmentExtractor.extract(input);
}
