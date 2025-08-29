const fs = require('fs');

// Read and analyze the failing test to understand expectations
const testContent = fs.readFileSync('tests/transformers/FilterableItemCollector.test.ts', 'utf8');

// Extract the failing test case
const lines = testContent.split('\n');
let inFailingTest = false;
let testLines = [];

for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    
    if (line.includes('should handle queries with function calls and expressions')) {
        inFailingTest = true;
    }
    
    if (inFailingTest) {
        testLines.push(line);
        if (line.trim() === '});' && testLines.length > 10) {
            break;
        }
    }
}

console.log('Failing test:');
console.log(testLines.join('\n'));
