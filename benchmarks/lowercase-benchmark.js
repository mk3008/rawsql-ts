/**
 * Benchmark comparing different lowercase checking strategies
 * 
 * This benchmark compares two approaches:
 * 1. Check if string is lowercase first, then convert if needed
 * 2. Always convert to lowercase
 * 
 * This benchmark demonstrates a counterintuitive result where Strategy 2 (always toLowerCase)
 * is consistently faster than Strategy 1 (check first) in all test cases.
 * 
 * RESULTS FROM ACTUAL RUN (Windows, Node.js v22.14.0, April 2025):
 * 
 * Strategy 1: Lower case only x 19,129,424 ops/sec ±1.42% (90 runs sampled)
 * Strategy 2: Lower case only x 95,061,465 ops/sec ±2.85% (84 runs sampled)
 * Strategy 1: Upper case only x 16,108,058 ops/sec ±1.05% (92 runs sampled)
 * Strategy 2: Upper case only x 91,823,825 ops/sec ±4.00% (82 runs sampled)
 * Strategy 1: Mixed case x 11,890,000 ops/sec ±0.67% (90 runs sampled)
 * Strategy 2: Mixed case x 121,035,949 ops/sec ±3.54% (82 runs sampled)
 * Strategy 1: Real-world mix (80% lowercase) x 19,973,500 ops/sec ±1.69% (93 runs sampled)
 * Strategy 2: Real-world mix (80% lowercase) x 94,010,339 ops/sec ±3.19% (83 runs sampled)
 * 
 * --- SUMMARY ---
 * 
 * Lower case only comparison:
 * Strategy 2 is 4.97x faster
 * 
 * Upper case only comparison:
 * Strategy 2 is 5.70x faster
 * 
 * Real-world mix comparison (80% lowercase):
 * Strategy 2 is 4.71x faster
 * 
 * Fastest overall:
 * Strategy 2: Mixed case
 * 
 * CONCLUSION:
 * Despite theory suggesting that checking before toLowerCase() would be more efficient,
 * real-world testing shows that always calling toLowerCase() is approximately 5x faster
 * in all scenarios. This is likely due to V8 engine optimizations that make toLowerCase()
 * highly efficient when no changes are needed.
 */

const Benchmark = require('benchmark');

// Strategy 1: Check if already lowercase first
function isAlreadyLowerCase(str) {
    return str === str.toLowerCase();
}

function strategy1(value) {
    return isAlreadyLowerCase(value) ? value : value.toLowerCase();
}

// Strategy 2: Always convert to lowercase
function strategy2(value) {
    return value.toLowerCase();
}

// Test data
const testStrings = {
    // Already lowercase strings (common case in SQL keywords)
    lowerCaseOnly: [
        "select",
        "from",
        "where",
        "group by",
        "order by",
        "having",
        "join",
    ],
    // Mixed case strings
    upperCaseOnly: [
        "SELECT",
        "FROM",
        "WHERE",
        "GROUP BY",
        "ORDER BY",
        "HAVING",
        "JOIN",
    ],
    // Mixed case strings
    mixed: [
        "this is a very long string that is already lowercase and represents a more complex situation",
        "THIS IS A VERY LONG STRING THAT IS ALL UPPERCASE AND REPRESENTS A MORE COMPLEX SITUATION",
        "This Is A Mixed Case String With Some Words Capitalized And Others Not"
    ],
    // Real-world mix (assume 80% of SQL keywords are already lowercase in typical usage)
    realWorldMix: [
        "select", "from", "where", "join", "having", // lowercase
        "SELECT", "GROUP BY", // uppercase (less common)
    ]
};

// Benchmark Suite
const suite = new Benchmark.Suite;

// Add tests
suite
    .add('Strategy 1: Lower case only', () => {
        for (const str of testStrings.lowerCaseOnly) {
            strategy1(str);
        }
    })
    .add('Strategy 2: Lower case only', () => {
        for (const str of testStrings.lowerCaseOnly) {
            strategy2(str);
        }
    })
    .add('Strategy 1: Upper case only', () => {
        for (const str of testStrings.upperCaseOnly) {
            strategy1(str);
        }
    })
    .add('Strategy 2: Upper case only', () => {
        for (const str of testStrings.upperCaseOnly) {
            strategy2(str);
        }
    })
    .add('Strategy 1: Mixed case', () => {
        for (const str of testStrings.mixed) {
            strategy1(str);
        }
    })
    .add('Strategy 2: Mixed case', () => {
        for (const str of testStrings.mixed) {
            strategy2(str);
        }
    })
    .add('Strategy 1: Real-world mix (80% lowercase)', () => {
        for (const str of testStrings.realWorldMix) {
            strategy1(str);
        }
    })
    .add('Strategy 2: Real-world mix (80% lowercase)', () => {
        for (const str of testStrings.realWorldMix) {
            strategy2(str);
        }
    })

    // Add listeners
    .on('cycle', (event) => {
        console.log(String(event.target));
    })
    .on('complete', function () {
        console.log('\n--- SUMMARY ---\n');

        // Fix: correct access to benchmark results array-like object
        // Convert benchmark suite to array we can work with
        const benchmarks = [];
        this.forEach(benchmark => benchmarks.push(benchmark));

        // Find specific benchmark results
        const lowerCaseTest1 = benchmarks.find(b => b.name === 'Strategy 1: Lower case only');
        const lowerCaseTest2 = benchmarks.find(b => b.name === 'Strategy 2: Lower case only');
        const upperCaseTest1 = benchmarks.find(b => b.name === 'Strategy 1: Upper case only');
        const upperCaseTest2 = benchmarks.find(b => b.name === 'Strategy 2: Upper case only');
        const realWorldTest1 = benchmarks.find(b => b.name === 'Strategy 1: Real-world mix (80% lowercase)');
        const realWorldTest2 = benchmarks.find(b => b.name === 'Strategy 2: Real-world mix (80% lowercase)');

        // Print results
        console.log('Lower case only comparison:');
        console.log(`Strategy ${lowerCaseTest1.hz > lowerCaseTest2.hz ? '1' : '2'} is ${(Math.max(lowerCaseTest1.hz, lowerCaseTest2.hz) / Math.min(lowerCaseTest1.hz, lowerCaseTest2.hz)).toFixed(2)}x faster`);

        console.log('\nUpper case only comparison:');
        console.log(`Strategy ${upperCaseTest1.hz > upperCaseTest2.hz ? '1' : '2'} is ${(Math.max(upperCaseTest1.hz, upperCaseTest2.hz) / Math.min(upperCaseTest1.hz, upperCaseTest2.hz)).toFixed(2)}x faster`);

        console.log('\nReal-world mix comparison (80% lowercase):');
        console.log(`Strategy ${realWorldTest1.hz > realWorldTest2.hz ? '1' : '2'} is ${(Math.max(realWorldTest1.hz, realWorldTest2.hz) / Math.min(realWorldTest1.hz, realWorldTest2.hz)).toFixed(2)}x faster`);

        console.log('\nFastest overall:');
        console.log(this.filter('fastest').map('name'));
    })

    // Run async
    .run({ 'async': true });

// Explanation of the strategies
console.log('\n--- EXPLANATION OF STRATEGIES ---\n');

console.log('Strategy 1: isAlreadyLowerCase + conditional logic');
console.log('- For lowercase strings: Only comparison, no new string allocation');
console.log('- For mixed/uppercase: Comparison + toLowerCase() allocation');

console.log('\nStrategy 2: Always toLowerCase()');
console.log('- For all strings: Always allocates new string, even when unnecessary');
console.log('- Simple code but potentially wasteful for already lowercase strings');

console.log('\nExpected outcome:');
console.log('- Strategy 1 should be faster for lowercase strings (common case in SQL keywords)');
console.log('- Strategy 2 might be slightly faster for uppercase strings');
console.log('- Strategy 1 should win for real-world mix where lowercase is common');