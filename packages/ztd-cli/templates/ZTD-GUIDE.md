# ZTD Implementation Guide

The `src/` directory should contain pure TypeScript logic that depends on the row interfaces produced by `tests/ztd-row-map.generated.ts`.
Avoid importing `tests/ztd-row-map.generated.ts` from production code; tests import the row map, repositories import DTOs, and fixtures live under `tests/`.
