import { describe, expect, it } from "vitest";
import { SelectQueryParser } from "../../src/parsers/SelectQueryParser";
import {
    QueryScopeCollector,
    queryScopeSelectorKey,
    resolveQueryScope,
} from "../../src/transformers/QueryScopeCollector";

describe("QueryScopeCollector", () => {
    it("collects semantic selectors for CTE, source, predicate, scalar, and set scopes", () => {
        const sql = `
            with base as (select id from orders),
            filtered as (
                select id
                from base b
                where exists (select 1 from payments p where p.order_id = b.id)
            )
            select x.id,
                   (select max(amount) from payments) as max_amount
            from (select id from filtered) x
            join (select id from refunds) r on r.id = x.id
            where x.id in (select order_id from payments)
            union all
            select id, 0 from archived_orders
        `;
        const scopes = new QueryScopeCollector().collect(SelectQueryParser.parse(sql));
        const keys = scopes.map((scope) => queryScopeSelectorKey(scope.selector));

        expect(scopes.map((scope) => scope.kind)).toEqual(expect.arrayContaining([
            "root",
            "cte",
            "derived",
            "scalar_subquery",
            "exists",
            "in_subquery",
            "set_operation",
        ]));
        expect(keys).toContain("v1/root/cte:0:base");
        expect(keys).toContain("v1/root/cte:1:filtered");
        expect(keys).toContain("v1/root/cte:1:filtered/expression:where:exists:0");
        expect(keys).toContain("v1/root/set:left/source:from:0");
        expect(keys).toContain("v1/root/set:left/source:join:0");
        expect(keys).toContain("v1/root/set:left/expression:select:scalar_subquery:0");
        expect(keys).toContain("v1/root/set:left/expression:where:in_subquery:0");
        expect(keys).toContain("v1/root/set:right");
        expect(new Set(keys).size).toBe(keys.length);
    });

    it("records structural parents for nested scopes", () => {
        const query = SelectQueryParser.parse(`
            with wrapped as (
                select *
                from (
                    select (select max(p.amount) from payments p) as amount
                    from orders
                ) nested
                where exists (select 1 from audit_log)
            )
            select * from wrapped
        `);
        const scopes = new QueryScopeCollector().collect(query);
        const byKey = new Map(scopes.map((scope) => [queryScopeSelectorKey(scope.selector), scope]));

        expect(queryScopeSelectorKey(byKey.get("v1/root/cte:0:wrapped/source:from:0")!.parentSelector!))
            .toBe("v1/root/cte:0:wrapped");
        expect(queryScopeSelectorKey(byKey.get("v1/root/cte:0:wrapped/source:from:0/expression:select:scalar_subquery:0")!.parentSelector!))
            .toBe("v1/root/cte:0:wrapped/source:from:0");
        expect(queryScopeSelectorKey(byKey.get("v1/root/cte:0:wrapped/expression:where:exists:0")!.parentSelector!))
            .toBe("v1/root/cte:0:wrapped");
    });

    it("produces identical selectors for repeated parses", () => {
        const sql = "select * from orders o where exists (select 1 from payments p where p.order_id = o.id)";
        const first = new QueryScopeCollector().collect(SelectQueryParser.parse(sql)).map((scope) => scope.selector);
        const second = new QueryScopeCollector().collect(SelectQueryParser.parse(sql)).map((scope) => scope.selector);

        expect(second).toEqual(first);
    });

    it("keeps an EXISTS selector stable when a boolean sibling is added", () => {
        const bareSql = `
            select *
            from orders o
            where exists (
                select 1 from payments p where p.order_id = o.order_id
            )
        `;
        const compoundSql = `${bareSql} and o.customer_id = :customer_id`;
        const bareScopes = new QueryScopeCollector().collect(SelectQueryParser.parse(bareSql));
        const compoundScopes = new QueryScopeCollector().collect(SelectQueryParser.parse(compoundSql));
        const bareExists = bareScopes.find((scope) => scope.kind !== "root")!;
        const compoundExists = compoundScopes.find((scope) => scope.kind !== "root")!;

        expect(bareExists.kind).toBe("exists");
        expect(compoundExists.kind).toBe("exists");
        expect(compoundExists.selector).toEqual(bareExists.selector);
        expect(compoundExists.parentSelector).toEqual(bareExists.parentSelector);
        expect(compoundScopes).toHaveLength(bareScopes.length);
    });

    it.each([
        ["EXISTS only", "exists (select 1 from payments p where p.order_id = o.order_id)"],
        ["EXISTS before AND sibling", "exists (select 1 from payments p where p.order_id = o.order_id) and o.customer_id = :customer_id"],
        ["EXISTS after AND sibling", "o.customer_id = :customer_id and exists (select 1 from payments p where p.order_id = o.order_id)"],
        ["EXISTS before OR sibling", "exists (select 1 from payments p where p.order_id = o.order_id) or o.customer_id = :customer_id"],
        ["parenthesized EXISTS before sibling", "(exists (select 1 from payments p where p.order_id = o.order_id)) and o.customer_id = :customer_id"],
        ["NOT EXISTS before sibling", "not exists (select 1 from payments p where p.order_id = o.order_id) and o.customer_id = :customer_id"],
        ["deeply nested EXISTS", "(exists (select 1 from payments p where p.order_id = o.order_id) and o.customer_id = :customer_id) or o.status = 'active'"],
    ])("classifies %s by its predicate role", (_name, predicate) => {
        const scopes = new QueryScopeCollector().collect(SelectQueryParser.parse(`
            select * from orders o where ${predicate}
        `));
        const expressionScope = scopes.find((scope) => scope.kind !== "root")!;

        expect(scopes).toHaveLength(2);
        expect(expressionScope.kind).toBe("exists");
        expect(expressionScope.selector).toEqual({
            path: [
                { kind: "root" },
                { clause: "where", index: 0, kind: "expression_subquery", subqueryKind: "exists" },
            ],
            version: 1,
        });
        expect(expressionScope.parentSelector).toEqual({ path: [{ kind: "root" }], version: 1 });
    });

    it("keeps IN selectors stable with boolean siblings", () => {
        const predicates = [
            "o.id in (select p.order_id from payments p)",
            "o.id in (select p.order_id from payments p) and o.status = 'active'",
        ];
        const selectors = predicates.map((predicate) => {
            const scopes = new QueryScopeCollector().collect(SelectQueryParser.parse(`
                select * from orders o where ${predicate}
            `));
            expect(scopes).toHaveLength(2);
            const scope = scopes.find((candidate) => candidate.kind !== "root")!;
            expect(scope.kind).toBe("in_subquery");
            return scope.selector;
        });

        expect(selectors[1]).toEqual(selectors[0]);
        expect(queryScopeSelectorKey(selectors[0])).toBe("v1/root/expression:where:in_subquery:0");
    });

    it("does not promote scalar subqueries to predicate subquery kinds", () => {
        const cases = [
            ["select", "select (select max(p.amount) from payments p) as max_amount from orders o"],
            ["where", `select * from orders o where o.amount >
                (select avg(p.amount) from payments p) and o.status = 'active'`],
        ] as const;

        for (const [clause, sql] of cases) {
            const scopes = new QueryScopeCollector().collect(SelectQueryParser.parse(sql));
            const scalar = scopes.find((scope) => scope.kind !== "root")!;
            expect(scalar.kind).toBe("scalar_subquery");
            expect(queryScopeSelectorKey(scalar.selector))
                .toBe(`v1/root/expression:${clause}:scalar_subquery:0`);
        }
    });

    it("does not inherit EXISTS from an unrelated boolean branch", () => {
        const scopes = new QueryScopeCollector().collect(SelectQueryParser.parse(`
            select *
            from orders o
            where exists (select 1 from payments p where p.order_id = o.order_id)
              and (select max(r.amount) from refunds r) > 0
        `));
        const keys = scopes.filter((scope) => scope.kind !== "root")
            .map((scope) => queryScopeSelectorKey(scope.selector));

        expect(keys).toEqual([
            "v1/root/expression:where:exists:0",
            "v1/root/expression:where:scalar_subquery:0",
        ]);
    });

    it("keeps kind-specific counters and collision-free selectors for mixed predicate subqueries", () => {
        const scopes = new QueryScopeCollector().collect(SelectQueryParser.parse(`
            select *
            from orders o
            where exists (select 1 from payments p where p.order_id = o.order_id)
              and o.id in (select r.order_id from refunds r)
        `));
        const expressionScopes = scopes.filter((scope) => scope.kind !== "root");
        const keys = expressionScopes.map((scope) => queryScopeSelectorKey(scope.selector));

        expect(scopes).toHaveLength(3);
        expect(expressionScopes.map((scope) => scope.kind)).toEqual(["exists", "in_subquery"]);
        expect(keys).toEqual([
            "v1/root/expression:where:exists:0",
            "v1/root/expression:where:in_subquery:0",
        ]);
        expect(new Set(keys).size).toBe(keys.length);
        expect(expressionScopes.every((scope) => queryScopeSelectorKey(scope.parentSelector!) === "v1/root"))
            .toBe(true);
    });

    it("uses clause-local occurrence indexes across multiple join predicates", () => {
        const scopes = new QueryScopeCollector().collect(SelectQueryParser.parse(`
            select o.id
            from orders o
            join customers c on exists (select 1 from customer_flags f where f.customer_id = c.id)
            join regions r on exists (select 1 from region_flags f where f.region_id = r.id)
        `));
        const keys = scopes.filter((scope) => scope.kind === "exists").map((scope) => queryScopeSelectorKey(scope.selector));

        expect(keys).toEqual([
            "v1/root/expression:join:exists:0",
            "v1/root/expression:join:exists:1",
        ]);
    });

    it("resolves one scope and reports not-found or ambiguous explicitly", () => {
        const scopes = new QueryScopeCollector().collect(SelectQueryParser.parse("select (select 1) as value"));
        const scalar = scopes.find((scope) => scope.kind === "scalar_subquery")!;

        expect(resolveQueryScope(scopes, scalar.selector)).toEqual({ scope: scalar, status: "found" });
        expect(resolveQueryScope(scopes, { path: [{ kind: "root" }, { kind: "set_branch", side: "right" }], version: 1 }))
            .toEqual({ status: "not_found" });
        expect(resolveQueryScope([scalar, scalar], scalar.selector)).toEqual({ matches: [scalar, scalar], status: "ambiguous" });
    });
});
