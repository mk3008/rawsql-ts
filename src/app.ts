import { DefaultFormatter } from './models/DefaultFormatter';
import { ValueParser } from './parsers/ValueParser';
import { SqlTokenizer } from './sqlTokenizer';

console.log('Hello world');

const tokenizer = new SqlTokenizer("CASE age WHEN 18 THEN 'young' WHEN 65 THEN 'senior' ELSE 'adult' END");
const lexemes = tokenizer.readLexmes();

console.log(lexemes);

const value = ValueParser.Parse(lexemes, 0);

console.log(value);

const formatter = new DefaultFormatter();
const sql = formatter.visit(value.value);

console.log(sql);
