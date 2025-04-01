# ts-sample

A sample SQL parser project implemented in TypeScript.

## Installation

Install the main project:

```bash
npm install
```

## Usage

Build the project:

```bash
npm run build
```

Run tests:

```bash
npm test
```

## Benchmarks

This project includes benchmarking functionality as a separate package.
To run benchmarks:

```bash
# Navigate to the benchmarks directory
cd benchmarks

# Install dependencies (only needed the first time)
npm install

# Run the benchmarks
npm run benchmark
```

The benchmarks measure the performance of SQL queries with different sizes and complexity.
Results are output in Markdown table format.