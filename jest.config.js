module.exports = {
    preset: 'ts-jest',
    testEnvironment: 'node',
    testMatch: ['**/tests/**/*.test.[jt]s'],
    moduleDirectories: ['node_modules', 'tests'],
    testPathIgnorePatterns: ['/dist/'],
};
