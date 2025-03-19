export default [
    {
        ignores: ["node_modules", "dist"], // 除外するフォルダ
    },
    {
        languageOptions: {
            parser: "@typescript-eslint/parser", // TypeScript 用パーサー
        },
        plugins: {
            "@typescript-eslint": require("@typescript-eslint/eslint-plugin"),
        },
        rules: {
            "indent": ["error", 4], // インデントは4スペース
            "max-len": ["error", { code: 120 }], // 1行120文字まで許可
            "no-mixed-spaces-and-tabs": "error", // タブとスペースの混在を禁止
            "curly": ["error", "all"], // if 文などは必ず `{}` で囲む
            "semi": ["error", "always"], // セミコロンを必ず付ける
            "quotes": ["error", "double"], // 文字列リテラルはダブルクォート
            "arrow-parens": ["error", "always"], // 矢印関数の括弧を必須にする
            "operator-linebreak": ["error", "before"], // 演算子は改行時に前に置く
            "multiline-ternary": ["error", "always-multiline"], // 三項演算子を必ず改行
            "brace-style": ["error", "1tbs", { allowSingleLine: false }], // ブレース `{}` のスタイル
            "@typescript-eslint/no-unused-vars": ["warn"], // 未使用の変数は警告
            "@typescript-eslint/explicit-function-return-type": ["error"], // 関数の戻り値の型を明示
            "@typescript-eslint/no-explicit-any": "warn", // `any` の使用を警告
        },
    },
];
