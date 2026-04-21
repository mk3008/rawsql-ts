const fs = require('node:fs');
const path = require('node:path');

const {
  MERGE_NO_EXCEPTION_LABEL,
  MERGE_EXCEPTION_LABEL,
  CLI_NO_PACKET_LABEL,
  CLI_PACKET_LABEL,
  SCAFFOLD_NO_PROOF_LABEL,
  SCAFFOLD_PROOF_LABEL,
  getChangedFiles,
  classifyPrReadiness,
  validatePrReadiness,
} = require('./check-pr-readiness.js');

function parseArgs(argv) {
  const options = {
    baseSha: null,
    headSha: null,
    changedFiles: [],
    summaryLines: [],
    verificationLines: [],
    baselineMode: 'no-exception',
    trackingIssue: '',
    scopedChecks: [],
    baselineRationale: '',
    cliMode: null,
    cliNoMigrationRationale: '',
    upgradeNote: '',
    deprecationPlan: '',
    docsUpdated: '',
    releaseWording: '',
    scaffoldMode: null,
    noProofRationale: '',
    nonEditAssertion: '',
    failFastProof: '',
    generatedOutputProof: '',
    outputPath: null,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    const next = argv[index + 1] ?? null;

    function requireOperand(flag) {
      const value = typeof next === 'string' ? next.trim() : '';
      if (!value || value.startsWith('--')) {
        throw new Error(`${flag} requires a non-empty value.`);
      }
      return next;
    }

    switch (arg) {
      case '--base-sha':
        options.baseSha = requireOperand(arg);
        index += 1;
        break;
      case '--head-sha':
        options.headSha = requireOperand(arg);
        index += 1;
        break;
      case '--changed-file':
        options.changedFiles.push(requireOperand(arg));
        index += 1;
        break;
      case '--summary-line':
        options.summaryLines.push(requireOperand(arg));
        index += 1;
        break;
      case '--verification':
        options.verificationLines.push(requireOperand(arg));
        index += 1;
        break;
      case '--baseline-mode':
        options.baselineMode = requireOperand(arg);
        index += 1;
        break;
      case '--tracking-issue':
        options.trackingIssue = requireOperand(arg);
        index += 1;
        break;
      case '--scoped-check':
        options.scopedChecks.push(requireOperand(arg));
        index += 1;
        break;
      case '--baseline-rationale':
        options.baselineRationale = requireOperand(arg);
        index += 1;
        break;
      case '--cli-mode':
        options.cliMode = requireOperand(arg);
        index += 1;
        break;
      case '--cli-no-migration-rationale':
        options.cliNoMigrationRationale = requireOperand(arg);
        index += 1;
        break;
      case '--upgrade-note':
        options.upgradeNote = requireOperand(arg);
        index += 1;
        break;
      case '--deprecation-plan':
        options.deprecationPlan = requireOperand(arg);
        index += 1;
        break;
      case '--docs-updated':
        options.docsUpdated = requireOperand(arg);
        index += 1;
        break;
      case '--release-wording':
        options.releaseWording = requireOperand(arg);
        index += 1;
        break;
      case '--scaffold-mode':
        options.scaffoldMode = requireOperand(arg);
        index += 1;
        break;
      case '--no-proof-rationale':
        options.noProofRationale = requireOperand(arg);
        index += 1;
        break;
      case '--non-edit-assertion':
        options.nonEditAssertion = requireOperand(arg);
        index += 1;
        break;
      case '--fail-fast-proof':
        options.failFastProof = requireOperand(arg);
        index += 1;
        break;
      case '--generated-output-proof':
        options.generatedOutputProof = requireOperand(arg);
        index += 1;
        break;
      case '--write':
        options.outputPath = requireOperand(arg);
        index += 1;
        break;
      default:
        break;
    }
  }

  return options;
}

function uniqueNonEmpty(values) {
  return Array.from(new Set(values.map((value) => String(value ?? '').trim()).filter(Boolean)));
}

function resolveChangedFiles(options) {
  const changedFiles = Array.isArray(options.changedFiles) ? options.changedFiles : [];

  if (changedFiles.length > 0) {
    return uniqueNonEmpty(changedFiles);
  }

  if (options.baseSha && options.headSha) {
    return getChangedFiles(options.baseSha, options.headSha);
  }

  throw new Error('prepare-pr-readiness requires either --changed-file or both --base-sha and --head-sha.');
}

function makeCheckbox(checked, label) {
  return `- [${checked ? 'x' : ' '}] ${label}`;
}

function renderList(lines, placeholder) {
  const renderedLines = uniqueNonEmpty(lines);
  if (renderedLines.length > 0) {
    return renderedLines.map((line) => `- ${line}`);
  }
  return [`- ${placeholder}`];
}

function joinInline(values, fallback) {
  const renderedValues = uniqueNonEmpty(values);
  return renderedValues.length > 0 ? renderedValues.join(', ') : fallback;
}

function requireOption(condition, value, message) {
  if (condition && !String(value ?? '').trim()) {
    throw new Error(message);
  }
}

function renderPrReadinessBody({ classification, options }) {
  const lines = [
    '## Summary',
    '',
    ...renderList(options.summaryLines, 'Summarize the user-facing change.'),
    '',
    '## Verification',
    '',
    ...renderList(options.verificationLines, 'List the checks you ran for this PR.'),
    '',
    '## Merge Readiness',
    '',
    makeCheckbox(options.baselineMode === 'no-exception', MERGE_NO_EXCEPTION_LABEL),
    makeCheckbox(options.baselineMode === 'exception', MERGE_EXCEPTION_LABEL),
    '',
    `Tracking issue: ${options.baselineMode === 'exception' ? options.trackingIssue : 'not needed; no baseline exception requested.'}`,
    `Scoped checks run: ${options.baselineMode === 'exception' ? joinInline(options.scopedChecks, '') : 'not needed; no baseline exception requested.'}`,
    `Why full baseline is not required: ${options.baselineMode === 'exception' ? options.baselineRationale : 'full baseline exception path not used for this PR.'}`,
    '',
    '## CLI Surface Migration',
    '',
    makeCheckbox(options.cliMode === 'no-packet', CLI_NO_PACKET_LABEL),
    makeCheckbox(options.cliMode === 'packet', CLI_PACKET_LABEL),
    '',
    `No-migration rationale: ${options.cliMode === 'no-packet' ? options.cliNoMigrationRationale : 'not selected for this PR.'}`,
    `Upgrade note: ${options.cliMode === 'packet' ? options.upgradeNote : 'not selected for this PR.'}`,
    `Deprecation/removal plan or issue: ${options.cliMode === 'packet' ? options.deprecationPlan : 'not selected for this PR.'}`,
    `Docs/help/examples updated: ${options.cliMode === 'packet' ? options.docsUpdated : 'not selected for this PR.'}`,
    `Release/changeset wording: ${options.cliMode === 'packet' ? options.releaseWording : 'not selected for this PR.'}`,
    '',
    '## Scaffold Contract Proof',
    '',
    makeCheckbox(options.scaffoldMode === 'no-proof', SCAFFOLD_NO_PROOF_LABEL),
    makeCheckbox(options.scaffoldMode === 'proof', SCAFFOLD_PROOF_LABEL),
    '',
    `No-proof rationale: ${options.scaffoldMode === 'no-proof' ? options.noProofRationale : 'not selected for this PR.'}`,
    `Non-edit assertion: ${options.scaffoldMode === 'proof' ? options.nonEditAssertion : 'not selected for this PR.'}`,
    `Fail-fast input-contract proof: ${options.scaffoldMode === 'proof' ? options.failFastProof : 'not selected for this PR.'}`,
    `Generated-output viability proof: ${options.scaffoldMode === 'proof' ? options.generatedOutputProof : 'not selected for this PR.'}`,
    '',
  ];

  if (!classification.requiresCliMigrationPacket) {
    lines[lines.indexOf(makeCheckbox(options.cliMode === 'no-packet', CLI_NO_PACKET_LABEL))] = makeCheckbox(false, CLI_NO_PACKET_LABEL);
    lines[lines.indexOf(makeCheckbox(options.cliMode === 'packet', CLI_PACKET_LABEL))] = makeCheckbox(false, CLI_PACKET_LABEL);
  }

  if (!classification.requiresScaffoldContractProof) {
    lines[lines.indexOf(makeCheckbox(options.scaffoldMode === 'no-proof', SCAFFOLD_NO_PROOF_LABEL))] = makeCheckbox(false, SCAFFOLD_NO_PROOF_LABEL);
    lines[lines.indexOf(makeCheckbox(options.scaffoldMode === 'proof', SCAFFOLD_PROOF_LABEL))] = makeCheckbox(false, SCAFFOLD_PROOF_LABEL);
  }

  return lines.join('\n');
}

function buildPreparedPrReadiness(options) {
  const changedFiles = resolveChangedFiles(options);
  const classification = classifyPrReadiness(changedFiles);

  if (!['no-exception', 'exception'].includes(options.baselineMode)) {
    throw new Error('--baseline-mode must be "no-exception" or "exception".');
  }

  if (options.baselineMode === 'exception') {
    requireOption(true, options.trackingIssue, 'Baseline exceptions require --tracking-issue.');
    requireOption(true, options.scopedChecks.join(' '), 'Baseline exceptions require at least one --scoped-check.');
    requireOption(true, options.baselineRationale, 'Baseline exceptions require --baseline-rationale.');
  }

  if (classification.requiresCliMigrationPacket) {
    if (!['no-packet', 'packet'].includes(options.cliMode)) {
      throw new Error('CLI-facing changes require --cli-mode set to "no-packet" or "packet".');
    }
    if (options.cliMode === 'no-packet') {
      requireOption(true, options.cliNoMigrationRationale, '--cli-no-migration-rationale is required when --cli-mode no-packet is selected.');
    } else {
      requireOption(true, options.upgradeNote, '--upgrade-note is required when --cli-mode packet is selected.');
      requireOption(true, options.deprecationPlan, '--deprecation-plan is required when --cli-mode packet is selected.');
      requireOption(true, options.docsUpdated, '--docs-updated is required when --cli-mode packet is selected.');
      requireOption(true, options.releaseWording, '--release-wording is required when --cli-mode packet is selected.');
    }
  }

  if (classification.requiresScaffoldContractProof) {
    if (!['no-proof', 'proof'].includes(options.scaffoldMode)) {
      throw new Error('Scaffold-related changes require --scaffold-mode set to "no-proof" or "proof".');
    }
    if (options.scaffoldMode === 'no-proof') {
      requireOption(true, options.noProofRationale, '--no-proof-rationale is required when --scaffold-mode no-proof is selected.');
    } else {
      requireOption(true, options.nonEditAssertion, '--non-edit-assertion is required when --scaffold-mode proof is selected.');
      requireOption(true, options.failFastProof, '--fail-fast-proof is required when --scaffold-mode proof is selected.');
      requireOption(true, options.generatedOutputProof, '--generated-output-proof is required when --scaffold-mode proof is selected.');
    }
  }

  const body = renderPrReadinessBody({ classification, options });
  const validation = validatePrReadiness({ body, classification });
  if (!validation.ok) {
    throw new Error(`Generated PR body did not satisfy the readiness contract:\n- ${validation.errors.join('\n- ')}`);
  }

  return {
    classification,
    body,
  };
}

function run(argv) {
  const options = parseArgs(argv);
  const result = buildPreparedPrReadiness(options);

  if (options.outputPath) {
    const outputPath = path.resolve(options.outputPath);
    fs.writeFileSync(outputPath, result.body, 'utf8');
    console.error(`[pr-readiness] wrote ${outputPath}`);
  } else {
    process.stdout.write(`${result.body}\n`);
  }

  if (result.classification.requiresCliMigrationPacket) {
    console.error(`[pr-readiness] CLI migration packet path prepared for: ${result.classification.cliMatchedFiles.join(', ')}`);
  }
  if (result.classification.requiresScaffoldContractProof) {
    console.error(`[pr-readiness] Scaffold contract proof path prepared for: ${result.classification.scaffoldMatchedFiles.join(', ')}`);
  }
}

if (require.main === module) {
  try {
    run(process.argv.slice(2));
  } catch (error) {
    console.error(`[pr-readiness] ${error.message}`);
    process.exit(1);
  }
}

module.exports = {
  buildPreparedPrReadiness,
  parseArgs,
  renderPrReadinessBody,
};
