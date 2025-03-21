export default [
    {
        ignores: ["node_modules", "dist"], // Exclude folders
    },
    {
        languageOptions: {
            parser: "@typescript-eslint/parser", // TypeScript parser
        },
        plugins: {
            "@typescript-eslint": require("@typescript-eslint/eslint-plugin"),
        },
        rules: {
            "indent": ["error", 4], // Indent with 4 spaces
            "max-len": ["error", { code: 120 }], // Allow up to 120 characters per line
            "no-mixed-spaces-and-tabs": "error", // Disallow mixed spaces and tabs
            "curly": ["error", "all"], // Always use curly braces for blocks
            "semi": ["error", "always"], // Always use semicolons
            "quotes": ["error", "double"], // Use double quotes for string literals
            "arrow-parens": ["error", "always"], // Always require parentheses around arrow function parameters
            "operator-linebreak": ["error", "before"], // Place operators before line breaks
            "multiline-ternary": ["error", "always-multiline"], // Always use multiline for ternary expressions
            "brace-style": ["error", "1tbs", { allowSingleLine: false }], // Brace style for blocks
            "@typescript-eslint/no-unused-vars": ["warn"], // Warn about unused variables
            "@typescript-eslint/explicit-function-return-type": ["error"], // Require explicit return types for functions
            "@typescript-eslint/no-explicit-any": "warn", // Warn about using 'any' type
        },
    },
];
