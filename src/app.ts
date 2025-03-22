import { DefaultFormatter } from './models/DefaultFormatter';
import { ValueParser } from './parsers/ValueParser';
import { SqlTokenizer } from './parsers/sqlTokenizer';

console.log('Hello world');

const tokenizer = new SqlTokenizer("CAST(id AS INTEGER)");
const lexemes = tokenizer.readLexmes();

console.log(lexemes);

const value = ValueParser.Parse(lexemes, 0);

console.log(value);

const formatter = new DefaultFormatter();
const sql = formatter.visit(value.value);

console.log(sql);
