# ZTD Implementation Guide

The `src/` directory should contain pure TypeScript logic that depends on the row interfaces produced by `tests/ztd-config.ts`.
Avoid importing `tests/ztd-config.ts` from production code; tests import the row map, repositories import DTOs, and fixtures live under `tests/`.
