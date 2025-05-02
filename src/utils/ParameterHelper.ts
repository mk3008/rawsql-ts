import { ParameterCollector } from "../transformers/ParameterCollector";
import { SqlComponent } from "../models/SqlComponent";

/**
 * Utility class for parameter operations on SQL queries.
 */
export class ParameterHelper {
    /**
     * Sets the value of a parameter by name in the given query.
     * Throws an error if the parameter is not found.
     * @param query The query object (must be a SqlComponent)
     * @param name Parameter name
     * @param value Value to set
     */
    public static set(query: SqlComponent, name: string, value: any): void {
        const params = ParameterCollector.collect(query);

        let found = false;
        for (const p of params) {
            if (p.name.value === name) {
                p.value = value;
                found = true;
            }
        }

        if (!found) {
            throw new Error(`Parameter '${name}' not found in query.`);
        }
    }
}
