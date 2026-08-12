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
