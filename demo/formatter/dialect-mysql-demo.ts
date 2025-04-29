// Execution instructions for Windows:
// 1. Open a terminal in the project root directory.
// 2. Run the following command:
//    npx ts-node demo/formatter/dialect-mysql-demo.ts

import { SelectQueryParser, Formatter } from 'rawsql-ts';

// Parameterized query written in MySQL dialect
const sql = 'select `user_id`, `name` from `users` where `active` = ?';
const query = SelectQueryParser.parse(sql);

// This implementation does not support unnamed parameters.