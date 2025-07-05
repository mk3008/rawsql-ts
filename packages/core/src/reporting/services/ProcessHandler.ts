import { SimpleSelectQuery } from '../../models/SimpleSelectQuery';
import { WhereClause } from '../../models/Clause';
import { ValueComponent, InlineQuery, FunctionCall, UnaryExpression, BinaryExpression } from '../../models/ValueComponent';
import { DataFlowGraph } from '../models/DataFlowGraph';
import { ProcessNode } from '../models/DataFlowNode';
import { DataSourceHandler } from './DataSourceHandler';

/**
 * Handles the processing of SQL clauses (WHERE, GROUP BY, HAVING, etc.)
 */
export class ProcessHandler {
    constructor(
        private graph: DataFlowGraph,
        private dataSourceHandler: DataSourceHandler
    ) {}

    /**
     * Processes SQL clauses in the correct execution order
     */
    processQueryClauses(
        query: SimpleSelectQuery,
        context: string,
        currentNodeId: string,
        cteNames: Set<string>,
        queryProcessor: (query: any, context: string, cteNames: Set<string>) => string
    ): string {
        let resultNodeId = currentNodeId;

        // 2. Process WHERE clause
        if (query.whereClause && resultNodeId) {
            resultNodeId = this.processWhereClause(query.whereClause, context, resultNodeId, cteNames, queryProcessor);
        }

        // 3. Process GROUP BY clause
        if (query.groupByClause && resultNodeId) {
            resultNodeId = this.processGroupByClause(context, resultNodeId);
        }

        // 4. Process HAVING clause
        if (query.havingClause && resultNodeId) {
            resultNodeId = this.processHavingClause(context, resultNodeId);
        }

        // 5. Process SELECT clause - only add if needed
        if (this.shouldAddSelectNode(query, context)) {
            resultNodeId = this.processSelectClause(context, resultNodeId);
        }

        // 6. Process ORDER BY clause
        if (query.orderByClause && resultNodeId) {
            resultNodeId = this.processOrderByClause(context, resultNodeId);
        }

        // 7. Process LIMIT/OFFSET clause
        if ((query.limitClause || query.offsetClause) && resultNodeId) {
            resultNodeId = this.processLimitClause(context, resultNodeId, !!query.offsetClause);
        }

        return resultNodeId;
    }

    /**
     * Processes WHERE clause including subqueries
     */
    private processWhereClause(
        whereClause: WhereClause,
        context: string,
        currentNodeId: string,
        cteNames: Set<string>,
        queryProcessor: (query: any, context: string, cteNames: Set<string>) => string
    ): string {
        const whereNode = this.graph.createProcessNode('where', context);

        // Connect FROM result to WHERE
        this.graph.addConnection(currentNodeId, whereNode.id);

        // Process WHERE subqueries
        const whereSubqueryInfo = this.processWhereSubqueries(whereClause, context, cteNames, queryProcessor);

        // Connect WHERE subqueries to WHERE node
        for (const subqueryInfo of whereSubqueryInfo) {
            this.graph.addConnection(subqueryInfo.nodeId, whereNode.id, subqueryInfo.operator);
        }

        return whereNode.id;
    }

    /**
     * Processes GROUP BY clause
     */
    private processGroupByClause(context: string, currentNodeId: string): string {
        const groupByNode = this.graph.createProcessNode('group by', context);
        this.graph.addConnection(currentNodeId, groupByNode.id);
        return groupByNode.id;
    }

    /**
     * Processes HAVING clause
     */
    private processHavingClause(context: string, currentNodeId: string): string {
        const havingNode = this.graph.createProcessNode('having', context);
        this.graph.addConnection(currentNodeId, havingNode.id);
        return havingNode.id;
    }

    /**
     * Processes SELECT clause
     */
    private processSelectClause(context: string, currentNodeId: string): string {
        const selectNode = this.graph.createProcessNode('select', context);
        this.graph.addConnection(currentNodeId, selectNode.id);
        return selectNode.id;
    }

    /**
     * Processes ORDER BY clause
     */
    private processOrderByClause(context: string, currentNodeId: string): string {
        const orderByNode = this.graph.createProcessNode('order by', context);
        this.graph.addConnection(currentNodeId, orderByNode.id);
        return orderByNode.id;
    }

    /**
     * Processes LIMIT/OFFSET clause
     */
    private processLimitClause(context: string, currentNodeId: string, hasOffset: boolean): string {
        const limitNode = this.graph.createProcessNode(hasOffset ? 'limit/offset' : 'limit', context);
        this.graph.addConnection(currentNodeId, limitNode.id);
        return limitNode.id;
    }

    /**
     * Determines if a SELECT node should be added
     */
    private shouldAddSelectNode(query: SimpleSelectQuery, context: string): boolean {
        // Always add SELECT node - UNION combines SELECT results, not raw data sources
        return true;
    }

    /**
     * Processes WHERE clause to find subqueries (EXISTS, IN, etc.)
     */
    private processWhereSubqueries(
        whereClause: WhereClause,
        context: string,
        cteNames: Set<string>,
        queryProcessor: (query: any, context: string, cteNames: Set<string>) => string
    ): Array<{ nodeId: string, operator: string }> {
        const subqueryInfo: Array<{ nodeId: string, operator: string }> = [];
        this.processValueComponent(whereClause.condition, context, cteNames, queryProcessor, subqueryInfo);
        return subqueryInfo;
    }

    /**
     * Recursively processes ValueComponent to find InlineQuery (subqueries)
     */
    private processValueComponent(
        value: ValueComponent,
        context: string,
        cteNames: Set<string>,
        queryProcessor: (query: any, context: string, cteNames: Set<string>) => string,
        subqueryInfo: Array<{ nodeId: string, operator: string }>
    ): void {
        if (value instanceof InlineQuery) {
            const subqueryNodeId = queryProcessor(value.selectQuery, `${context}_where_subquery`, cteNames);
            subqueryInfo.push({ nodeId: subqueryNodeId, operator: 'SUBQUERY' });
        } else if (value instanceof FunctionCall) {
            const functionName = value.qualifiedName.name.toString().toLowerCase();
            if (functionName === 'exists' && value.argument instanceof InlineQuery) {
                const subqueryNodeId = queryProcessor(value.argument.selectQuery, `${context}_where_subquery`, cteNames);
                subqueryInfo.push({ nodeId: subqueryNodeId, operator: 'EXISTS' });
            } else if (value.argument) {
                this.processValueComponent(value.argument, context, cteNames, queryProcessor, subqueryInfo);
            }
        } else if (value instanceof UnaryExpression) {
            const operator = value.operator.value.toLowerCase();
            if ((operator === 'exists' || operator === 'not exists') && value.expression instanceof InlineQuery) {
                this.processQueryTablesOnly(value.expression.selectQuery, context, cteNames, subqueryInfo, operator.toUpperCase());
            } else {
                this.processValueComponent(value.expression, context, cteNames, queryProcessor, subqueryInfo);
            }
        } else if (value instanceof BinaryExpression) {
            const operator = value.operator.value.toLowerCase();
            if ((operator === 'in' || operator === 'not in') && value.right instanceof InlineQuery) {
                this.processQueryTablesOnly(value.right.selectQuery, context, cteNames, subqueryInfo, operator.toUpperCase());
            } else {
                this.processValueComponent(value.left, context, cteNames, queryProcessor, subqueryInfo);
                this.processValueComponent(value.right, context, cteNames, queryProcessor, subqueryInfo);
            }
        } else if (value && typeof value === 'object') {
            for (const [key, val] of Object.entries(value)) {
                if (val && typeof val === 'object') {
                    if (Array.isArray(val)) {
                        val.forEach(item => {
                            if (item && typeof item === 'object' && 'selectQuery' in item) {
                                this.processValueComponent(item as ValueComponent, context, cteNames, queryProcessor, subqueryInfo);
                            }
                        });
                    } else if ('selectQuery' in val) {
                        this.processValueComponent(val as ValueComponent, context, cteNames, queryProcessor, subqueryInfo);
                    }
                }
            }
        }
    }

    /**
     * Processes only the tables from a query for EXISTS/NOT EXISTS conditions
     */
    private processQueryTablesOnly(
        query: any,
        context: string,
        cteNames: Set<string>,
        subqueryInfo: Array<{ nodeId: string, operator: string }>,
        operator: string
    ): void {
        if (query.fromClause) {
            const tableNodes = this.dataSourceHandler.extractTableNodeIds(query.fromClause, cteNames);
            for (const tableNodeId of tableNodes) {
                subqueryInfo.push({ nodeId: tableNodeId, operator });
            }
        }
    }
}