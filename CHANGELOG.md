This file explains how Visual Studio created the project.

The following tools were used to generate this project:
- TypeScript Compiler (tsc)

The following steps were used to generate this project:
- Create project file (`NodeConsoleApp1.esproj`).
- Create `launch.json` to enable debugging.
- Install npm packages and create `tsconfig.json`: `npm init && npm i --save-dev eslint typescript @types/node && npx tsc --init --sourceMap true`.
- Create `app.ts`.
- Update `package.json` entry point.
- Update TypeScript build scripts in `package.json`.
- Create `eslint.config.js` to enable linting.
- Add project to solution.
- Write this file.
