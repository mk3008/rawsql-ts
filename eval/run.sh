#!/usr/bin/env bash
set -euo pipefail

CASE="crud-basic"
SCENARIO="crud-basic"
LOOP=0
KEEP_WORKSPACE=false
SKIP_AI=false
REPORT="eval/reports/latest.json"

while [[ $# -gt 0 ]]; do
  case "$1" in
    --case)
      CASE="${2:-crud-basic}"
      shift 2
      ;;
    --scenario)
      SCENARIO="${2:-crud-basic}"
      shift 2
      ;;
    --loop)
      LOOP="${2:-0}"
      shift 2
      ;;
    --keep-workspace)
      KEEP_WORKSPACE=true
      shift
      ;;
    --skip-ai)
      SKIP_AI=true
      shift
      ;;
    --report)
      REPORT="${2:-eval/reports/latest.json}"
      shift 2
      ;;
    *)
      echo "Unknown argument: $1" >&2
      exit 1
      ;;
  esac
done

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"

if [[ -z "${EVAL_WORKSPACE_ROOT:-}" ]]; then
  EVAL_WORKSPACE_ROOT="${HOME}/_ztd_eval/workspaces"
fi

if [[ -z "${EVAL_CODEX_HOME:-}" ]]; then
  EVAL_CODEX_HOME="${EVAL_WORKSPACE_ROOT}/_codex_home"
fi

export EVAL_WORKSPACE_ROOT
export EVAL_CODEX_HOME
export CODEX_HOME="${EVAL_CODEX_HOME}"

mkdir -p "${EVAL_CODEX_HOME}"

if [[ "${LOOP}" -gt 0 ]]; then
  ARGS=("${REPO_ROOT}/eval/loop.ts" "--loop" "${LOOP}" "--scenario" "${SCENARIO}" "--report-prefix" "eval/reports/loop")
  if [[ "${KEEP_WORKSPACE}" == "true" ]]; then
    ARGS+=("--keep-workspace")
  fi
else
  ARGS=("${REPO_ROOT}/eval/runner.ts" "--case" "${CASE}" "--scenario" "${SCENARIO}" "--report" "${REPORT}")
  if [[ "${KEEP_WORKSPACE}" == "true" ]]; then
    ARGS+=("--keep-workspace")
  fi
  if [[ "${SKIP_AI}" == "true" ]]; then
    ARGS+=("--skip-ai")
  fi
fi

pnpm exec ts-node "${ARGS[@]}"
