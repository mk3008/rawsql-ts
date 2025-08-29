const { SelectQueryParser, FilterableItemCollector } = require('./dist/index.js');

// Test case 1: Function calls and expressions
const sql1 = `
    SELECT COUNT(*) as total, AVG(price) as avg_price
    FROM sales
    WHERE created_date >= :start_date AND YEAR(created_date) = :year
`;

console.log("=== Test Case 1: Function calls ===");
try {
    const query1 = SelectQueryParser.parse(sql1);
    const collector1 = new FilterableItemCollector(undefined, { upstream: false });
    const items1 = collector1.collect(query1);
    const columns1 = items1.filter(item => item.type === 'column');
    const params1 = items1.filter(item => item.type === 'parameter');
    
    console.log("Columns found:", columns1.map(c => c.name));
    console.log("Parameters found:", params1.map(p => p.name));
    console.log("Looking for 'price':", columns1.find(c => c.name === 'price'));
    console.log("Looking for 'created_date':", columns1.find(c => c.name === 'created_date'));
} catch (e) {
    console.error("Error:", e.message);
}

