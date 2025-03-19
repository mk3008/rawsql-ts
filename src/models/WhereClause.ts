import { SqlComponent } from "./SqlComponent";

export class WhereClause extends SqlComponent {
    static kind = Symbol("WhereClause");
    condition: SqlComponent;
    constructor(condition: SqlComponent) {
        super();
        this.condition = condition;
    }
}