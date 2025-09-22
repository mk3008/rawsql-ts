import { describe, test, expect } from 'vitest';
import { LinePrinter } from '../../src/transformers/LinePrinter';

describe('LinePrinter - Comma Break Styles', () => {
    test('should NOT move comma to previous line when commaBreak is "before"', () => {
        // Arrange - 前カンマスタイルの場合
        const printer = new LinePrinter(' ', 4, '\n', 'before');

        // Simulate: appendNewline() then appendText(',') - this is what SqlPrinter does for "before" style
        printer.appendText('SELECT');
        printer.appendNewline(1);
        printer.appendText('"field1" /* comment */');
        printer.appendNewline(1); // This creates empty line where comma should go
        printer.appendText(','); // Comma should stay on this line for "before" style
        printer.appendText(' "field2"');

        // Act
        const result = printer.print();

        // Assert - 前カンマの場合、カンマは新しい行の先頭に残るべき
        expect(result).toContain('"field1" /* comment */\n    , "field2"');
        expect(result).not.toContain('"field1" /* comment */,');
    });

    test('should move comma to previous line when commaBreak is "after"', () => {
        // Arrange - 後ろカンマの場合
        const printer = new LinePrinter(' ', 4, '\n', 'after');

        // Simulate the scenario where comma ends up on empty line due to comment formatting
        printer.appendText('SELECT');
        printer.appendNewline(1);
        printer.appendText('"field1" /* comment */');
        printer.appendNewline(1); // Empty line created
        printer.appendText(','); // Comma should be moved to previous line
        printer.appendText(' "field2"');

        // Act
        const result = printer.print();

        // Assert - 後ろカンマの場合、カンマは前の行に移動すべき
        expect(result).toContain('"field1" /* comment */,');
        expect(result).not.toContain('/* comment */\n    ,');
    });

    test('should NOT move comma when commaBreak is "none" (no line breaks)', () => {
        // Arrange - 改行なしの場合
        const printer = new LinePrinter(' ', 4, '\n', 'none');

        // Simulate normal none behavior - comma should stay where it is
        printer.appendText('SELECT');
        printer.appendNewline(1);
        printer.appendText('"field1" /* comment */');
        printer.appendText(','); // Comma should stay on same line
        printer.appendText(' "field2"');

        // Act
        const result = printer.print();

        // Assert - noneの場合、カンマは移動せず元の位置に残る
        expect(result).toContain('"field1" /* comment */, "field2"');
    });
});