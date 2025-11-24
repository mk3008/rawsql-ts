const { DDLDiffGenerator } = require('./dist/cjs/index.js');

console.log('=== Test 1: checkConstraintNames=true ===');
const current1 = `CREATE TABLE posts (id INT, user_id INT);
CREATE INDEX idx_posts_user_id ON posts(user_id);`;
const expected1 = `CREATE TABLE posts (id INT, user_id INT);
CREATE INDEX idx_posts_1 ON posts(user_id);`;
const diff1 = DDLDiffGenerator.generateDiff(current1, expected1, {
    checkConstraintNames: true,
    dropConstraints: true
});
console.log('Diff length:', diff1.length);
diff1.forEach((d, i) => console.log(`[${i}]:`, d));

console.log('\n=== Test 2: checkConstraintNames=false ===');
const diff2 = DDLDiffGenerator.generateDiff(current1, expected1, {
    checkConstraintNames: false,
    dropConstraints: true
});
console.log('Diff length:', diff2.length);
diff2.forEach((d, i) => console.log(`[${i}]:`, d));
