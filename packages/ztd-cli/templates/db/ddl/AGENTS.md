# DDL Guidance

- Keep one schema file per logical schema when possible.
- Treat these files as human-owned inputs for generation and validation.
- Prefer explicit table and column changes over broad rewrite noise.
- Do not apply migrations automatically from an instruction file.

After editing DDL, regenerate artifacts before judging the runtime impact.
