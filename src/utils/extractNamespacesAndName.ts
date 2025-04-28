// Utility to extract namespaces and the final name from an array of identifiers
// Example: ["db", "schema", "users"] => { namespaces: ["db", "schema"], name: "users" }
function extractNamespacesAndName(identifiers: string[]): { namespaces: string[] | null, name: string } {
    if (!identifiers || identifiers.length === 0) {
        throw new Error("Identifier list is empty");
    }
    if (identifiers.length === 1) {
        return { namespaces: null, name: identifiers[0] };
    }
    return {
        namespaces: identifiers.slice(0, -1),
        name: identifiers[identifiers.length - 1]
    };
}

export { extractNamespacesAndName };
