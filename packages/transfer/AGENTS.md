# @rawsql-ts/transfer Guidance

## 転送制御モデル

dirty key、work item、transfer request、key map、active black、lineage、generated transfer SQL、転送実行に関わる実装を行う前に、以下を読むこと。

- `packages/transfer/docs/concepts/README.md`
- `packages/transfer/docs/concepts/dirty-key/SPEC.md`

dirty key の意味をIssueやfeature内で再定義しないこと。

上記ドキュメントを、dirty key management に関する現在の仕様正本として扱うこと。
