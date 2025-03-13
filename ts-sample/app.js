"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const SqlTokenizer_1 = require("./SqlTokenizer");
console.log('Hello world');
const tokenizer = new SqlTokenizer_1.SqlTokenizer('a.id');
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
//# sourceMappingURL=app.js.map