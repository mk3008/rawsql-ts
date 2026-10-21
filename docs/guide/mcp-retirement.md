# MCP integration retirement

`@rawsql-ts/mcp-server` and its `rawsql-ts-mcp` executable are retired from this
repository. The MCP package will no longer receive updates here. Its dedicated
browser demo, SDK dependency, stdio adapter, server tests, and package verification
have been removed.

The SQL analysis engines remain available as `rawsql-ts`,
`@rawsql-ts/investigation-core`, and `@rawsql-ts/sql-grep-core`. Existing independent CLI
workflows remain unchanged. This retirement does not introduce replacement CLI
commands or promise one command for every former MCP tool.

## Existing MCP installations

Remove the `rawsql-ts-mcp` server entry from your MCP host configuration and remove
`@rawsql-ts/mcp-server` from the dependencies of the application that installed it.
Update integrations to use the existing library APIs or an existing CLI workflow
where it meets your needs. MCP-specific schemas, workspace restrictions, DDL
loaders, compact responses, and serialization helpers are not supported as a
separate API.

Removing source from this repository does not uninstall existing copies or remove
any published npm versions. It does not update an npm deprecation message. Historical
research under `docs/dogfooding`, journals under `docs/journal`, and the archived
`scripts/mcp-integration-eval` harness remain as records of the earlier work;
their conclusions and setup instructions describe that earlier implementation.

## npm notice proposal (requires maintainer authorization)

If published npm versions are confirmed, a maintainer can separately approve
deprecating those versions after accepting the retirement, with the following
notice:

```sh
npm deprecate '@rawsql-ts/mcp-server@*' 'The rawsql-ts MCP integration is retired and will receive no further updates. Existing SQL libraries and CLI workflows remain available. Remove the rawsql-ts-mcp host entry and see https://github.com/mk3008/rawsql-ts/blob/main/docs/guide/mcp-retirement.md for migration guidance.'
```

This command is a proposal, not part of the repository change. Check the registry
versions and existing deprecation messages before executing it. If the package lookup returns E404, there is no publicly accessible version to
deprecate; do not create a release just to publish a deprecation notice. Do not
unpublish old versions. Publish the migration notice at the linked main-branch path before
applying that message.

Retiring this delivery surface is breaking for MCP consumers. No replacement MCP
version is planned, so no major-version Changeset is added for the deleted
package. Pending MCP-only Changesets are removed; mixed Changesets keep their
existing library release targets and describe the surviving library changes.
No library version or public API changes as part of the retirement. The README
update in `investigation-core` only removes the retired integration link.
