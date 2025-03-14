import { SqlTokenizer } from './sqlTokenizer'; 

console.log('Hello world');


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