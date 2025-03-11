import { SqlTokenizer } from './SqlTokenizer';

console.log('Hello world');


const tokenizer = new SqlTokenizer('a.id');
let token;
while ((token = tokenizer.getNextToken()) !== null) {
    console.log(token);
}


process.stdin.resume();
process.stdin.setEncoding('utf8');

// press Enter to exit
process.stdin.on('data', function () {
    console.log('Exiting...');
    process.exit();
});