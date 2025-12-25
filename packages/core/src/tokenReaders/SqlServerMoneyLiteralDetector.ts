import { CharLookupTable } from '../utils/charLookupTable';

/**
 * Detects SQL Server MONEY literals that start with `$` and that use thousands-group formatting.
 * This helper coexists with parameter parsing so the tokenizer can decide whether to treat
 * `$1,234` as a literal or keep `$1` as a positional parameter.
 */
export function looksLikeSqlServerMoneyLiteral(input: string, position: number): boolean {
    const length = input.length;
    if (position < 0 || position + 1 >= length) {
        return false;
    }

    if (input[position] !== '$' || !CharLookupTable.isDigit(input[position + 1])) {
        return false;
    }

    let pos = position + 1;

    // Consume the initial run of digits that follows the dollar sign.
    while (pos < length && CharLookupTable.isDigit(input[pos])) {
        pos++;
    }

    // Allow dollar values with a decimal part (e.g. `$123.45`) without requiring commas.
    if (pos < length && input[pos] === '.' && pos + 1 < length && CharLookupTable.isDigit(input[pos + 1])) {
        return true;
    }

    let sawThousandsGroup = false;

    // Consume contiguous comma + 3-digit groups, stopping if the comma is not followed by immediate digits.
    while (pos < length && input[pos] === ',') {
        const groupStart = pos + 1;

        if (groupStart >= length || !CharLookupTable.isDigit(input[groupStart])) {
            break;
        }

        const groupEnd = groupStart + 3;
        for (let index = groupStart; index < groupEnd; index++) {
            if (index >= length || !CharLookupTable.isDigit(input[index])) {
                return false;
            }
        }

        sawThousandsGroup = true;
        pos = groupEnd;
    }

    if (!sawThousandsGroup) {
        return false;
    }

    // Allow an optional decimal fraction after the thousands groups.
    if (pos < length && input[pos] === '.') {
        const decimalStart = pos + 1;
        if (decimalStart >= length || !CharLookupTable.isDigit(input[decimalStart])) {
            return false;
        }

        let decimalPos = decimalStart;
        while (decimalPos < length && CharLookupTable.isDigit(input[decimalPos])) {
            decimalPos++;
        }
    }

    return true;
}
