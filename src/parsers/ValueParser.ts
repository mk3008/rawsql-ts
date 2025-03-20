import { Lexeme, TokenType } from "../models/Lexeme";
import { ColumnReference, ValueComponent, LiteralValue, BinaryExpression, ParenExpression, FunctionCall, ValueCollection, UnaryExpression, ParameterExpression, ArrayExpression } from "../models/ValueComponent";
import { SqlTokenizer } from "../sqlTokenizer";

export class ValueParser {
    public static ParseFromText(query: string): ValueComponent {
        const tokenizer = new SqlTokenizer(query); // トークナイザの初期化
        const lexemes = tokenizer.readLexmes(); // トークンの取得

        // パース
        const result = this.Parse(lexemes, 0);

        // 残りのトークンがある場合はエラー
        if (result.newPosition < lexemes.length) {
            throw new Error(`Unexpected token at position ${result.newPosition}: ${lexemes[result.newPosition].value}`);
        }

        return result.value;
    }

    public static Parse(lexemes: Lexeme[], position: number): { value: ValueComponent; newPosition: number } {
        const result = this.ParseItem(lexemes, position);
        let newPosition = result.newPosition;

        // 次の要素が演算子の場合、二項演算式として処理する
        if (newPosition < lexemes.length && lexemes[newPosition].type === TokenType.Operator) {
            const operator = lexemes[newPosition].value;
            newPosition++;

            // 右側の値を取得
            const rightResult = this.Parse(lexemes, newPosition);
            newPosition = rightResult.newPosition;

            // 二項演算式を作成
            const value = new BinaryExpression(result.value, operator, rightResult.value);
            return { value, newPosition };
        }

        return { value: result.value, newPosition };
    }

    private static ParseItem(lexemes: Lexeme[], position: number): { value: ValueComponent; newPosition: number } {
        let newPosition = position;

        // range check
        if (newPosition >= lexemes.length) {
            throw new Error(`Unexpected end of lexemes at position ${position}`);
        }

        if (lexemes[newPosition].type === TokenType.Identifier) {
            return this.ParseIdentifier(lexemes, newPosition);
        } else if (lexemes[newPosition].type === TokenType.Literal) {
            return this.ParseLiteralValue(lexemes, newPosition);
        } else if (lexemes[newPosition].type === TokenType.OpenParen) {
            return this.ParseParenExpression(lexemes, newPosition);
        } else if (lexemes[newPosition].type === TokenType.Function) {
            return this.ParseFunctionCall(lexemes, newPosition);
        } else if (lexemes[newPosition].type === TokenType.Operator) {
            return this.ParseUnaryExpression(lexemes, newPosition);
        } else if (lexemes[newPosition].type === TokenType.Parameter) {
            return this.ParseParameterExpression(lexemes, newPosition);
        } else if (lexemes[newPosition].type === TokenType.Command) {
            // case 
        }

        throw new Error(`Invalid lexeme. position: ${position}, type: ${lexemes[position].type}, value: ${lexemes[position].value}`);
    }

    private static ParseParameterExpression(lexemes: Lexeme[], newPosition: number): { value: ValueComponent; newPosition: number; } {
        // パラメータ記号（1文字目）は含めない
        const value = new ParameterExpression(lexemes[newPosition].value.slice(1));
        newPosition++;
        return { value, newPosition };
    }

    private static ParseLiteralValue(lexemes: Lexeme[], position: number): { value: ValueComponent; newPosition: number } {
        // リテラル値の処理
        const value = new LiteralValue(lexemes[position].value);
        return { value, newPosition: position + 1 };
    }

    private static ParseUnaryExpression(lexemes: Lexeme[], position: number): { value: ValueComponent; newPosition: number } {
        let newPosition = position;

        // 単項演算子の処理
        if (newPosition < lexemes.length && lexemes[newPosition].type === TokenType.Operator) {
            const operator = lexemes[newPosition].value;
            newPosition++;

            // 単項演算子の右側の値を取得
            const result = this.Parse(lexemes, newPosition);
            newPosition = result.newPosition;

            // 単項演算式を作成
            const value = new UnaryExpression(operator, result.value);
            return { value, newPosition };
        }

        throw new Error(`Invalid unary expression at position ${position}: ${lexemes[position].value}`);
    }

    private static ParseIdentifier(lexemes: Lexeme[], position: number): { value: ValueComponent; newPosition: number } {
        // カラム参照のパターンをチェック ([identifier dot] * n + identifier)
        const identifiers: string[] = [];
        let newPosition = position;

        // 最初の識別子を追加
        identifiers.push(lexemes[newPosition].value);
        newPosition++;

        // ドットと識別子のパターンを探す
        while (
            newPosition < lexemes.length &&
            newPosition + 1 < lexemes.length &&
            lexemes[newPosition].type === TokenType.Dot &&
            lexemes[newPosition + 1].type === TokenType.Identifier
        ) {
            // ドットをスキップして次の識別子を追加
            newPosition++;
            identifiers.push(lexemes[newPosition].value);
            newPosition++;
        }

        if (identifiers.length > 1) {
            // 複数の識別子があればカラム参照として処理
            const lastIdentifier = identifiers.pop() || '';
            const value = new ColumnReference(identifiers, lastIdentifier);
            return { value, newPosition: newPosition };
        } else {
            // 単一の識別子の場合は単純な識別子として処理
            const value = new ColumnReference(null, lexemes[newPosition].value);
            return { value, newPosition };
        }
    }

    private static ParseFunctionCall(lexemes: Lexeme[], position: number): { value: ValueComponent; newPosition: number } {
        let newPosition = position;

        // 関数名を取得
        const result = lexemes[newPosition];
        const functionName = result.value;
        newPosition++;

        if (result.command === "array") {
            // array関数は[]で囲む
            const arg = this.ParseBracket(lexemes, newPosition);
            newPosition = arg.newPosition;
            const value = new ArrayExpression(arg.value);
            return { value, newPosition };
        } else if (newPosition < lexemes.length && lexemes[newPosition].type === TokenType.OpenParen) {
            // 汎用引数解析
            const arg = this.ParseParen(lexemes, newPosition);
            newPosition = arg.newPosition;
            const value = new FunctionCall(functionName, arg.value);
            return { value, newPosition };
        } else {
            throw new Error(`Expected opening parenthesis after function name '${functionName}' at position ${newPosition}`);
        }
    }

    private static ParseParenExpression(lexemes: Lexeme[], position: number): { value: ParenExpression; newPosition: number } {
        const result = this.ParseParen(lexemes, position);
        const value = new ParenExpression(result.value);
        return { value, newPosition: result.newPosition };
    }

    private static ParseParen(lexemes: Lexeme[], position: number): { value: ValueComponent; newPosition: number } {
        return this.ParseArgumentExpression(TokenType.OpenParen, TokenType.CloseParen, lexemes, position);
    }

    private static ParseBracket(lexemes: Lexeme[], position: number): { value: ValueComponent; newPosition: number } {
        return this.ParseArgumentExpression(TokenType.OpenBracket, TokenType.CloseBracket, lexemes, position);
    }

    private static ParseArgumentExpression(oepnToken: TokenType, closeToken: TokenType, lexemes: Lexeme[], position: number): { value: ValueComponent; newPosition: number } {
        let newPosition = position;
        let args: ValueComponent[] = [];

        // 開きカッコを確認
        if (newPosition < lexemes.length && lexemes[newPosition].type === oepnToken) {
            newPosition++;

            // 中の値を解析
            const result = this.Parse(lexemes, newPosition);
            newPosition = result.newPosition;
            args.push(result.value);

            // 次の要素がカンマの場合、読み続ける
            while (newPosition < lexemes.length && lexemes[newPosition].type === TokenType.Comma) {
                newPosition++;
                const argResult = this.Parse(lexemes, newPosition);
                newPosition = argResult.newPosition;
                args.push(argResult.value);
            }

            // 閉じカッコを確認
            if (newPosition < lexemes.length && lexemes[newPosition].type === closeToken) {
                newPosition++;
                if (args.length === 1) {
                    // 引数が1つだけの場合はそのまま返す
                    return { value: args[0], newPosition };
                }
                // 引数が複数ある場合はValueCollectionを作成
                const value = new ValueCollection(args);
                return { value, newPosition };
            } else {
                throw new Error(`Missing closing parenthesis at position ${newPosition}`);
            }
        }

        throw new Error(`Expected opening parenthesis at position ${position}`);
    }
}
