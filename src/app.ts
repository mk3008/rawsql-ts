import { SqlTokenizer } from './sqlTokenizer'; 

console.log('Hello world');

const tokenizer2 =new SqlTokenizer('0x1A3F');
tokenizer2.readLexme()

const tokenizer = new SqlTokenizer('a.id');
let token;
while ((token = tokenizer.readLexme()) !== null) {
    console.log(token);
}


process.stdin.resume();
process.stdin.setEncoding('utf8');

// press Enter to exit
process.stdin.on('data', function () {
    console.log('Exiting...');
    process.exit();
});