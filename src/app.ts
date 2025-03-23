import { DefaultFormatter } from './models/DefaultFormatter';
import { ValueParser } from './parsers/ValueParser';
import { SqlTokenizer } from './parsers/sqlTokenizer';

console.log('Hello world');

const tokenizer = new SqlTokenizer(`
    /*

    block comment 1

    block comment 2
    
    */
   -- line comment 1
   -- line comment 2
   price/*comment x 1*/::/*comment x 2*/NUMERIC(10,2)
    /*
    
    block comment 3

    block comment 4
    
    */
   -- line comment 3
   -- line comment 4
    `);
const lexemes = tokenizer.readLexmes();

console.log(lexemes);

const value = ValueParser.Parse(lexemes, 0);

console.log(value);

const formatter = new DefaultFormatter();
const sql = formatter.visit(value.value);

console.log(sql);
