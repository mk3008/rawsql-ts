import type { TableFixture } from '@rawsql-ts/testkit-core';
import type { ZtdBenchMetricsCollector, ZtdExecutionMode } from './testkit-client';
import { ConnectionLogger, ConnectionModel, DbConcurrencyMode, ModeLabel, RunPhase } from './diagnostics';
import { createTestkitClient } from './testkit-client';
import { BenchmarkRepository, assertExpectedRows } from './bench-repository';
import {
  buildCustomerSummaryFixtures,
  buildProductRankingFixtures,
  buildSalesSummaryFixtures,
} from './bench-fixtures';

export type ZtdBenchCaseOptions = {
  schemaName: string;
  metricsCollector?: ZtdBenchMetricsCollector;
  connectionModel?: ConnectionModel;
  connectionLogger?: ConnectionLogger;
  scenarioLabel?: string;
  mode?: ModeLabel;
  workerId?: string;
  caseName?: string;
  suiteMultiplier?: number;
  runIndex?: number;
  phase?: RunPhase;
  parallelWorkerCount?: number;
  applicationName?: string;
  dbConcurrencyMode?: DbConcurrencyMode;
  executionMode?: ZtdExecutionMode;
};

async function runCase(
  fixtures: TableFixture[],
  repositoryCallback: (repository: BenchmarkRepository) => Promise<void>,
  options: ZtdBenchCaseOptions,
): Promise<void> {
  const client = await createTestkitClient(fixtures, {
    schemaName: options.schemaName,
    metricsCollector: options.metricsCollector,
    connectionModel: options.connectionModel,
    connectionLogger: options.connectionLogger,
    scenarioLabel: options.scenarioLabel,
    mode: options.mode,
    workerId: options.workerId,
    caseName: options.caseName,
    suiteMultiplier: options.suiteMultiplier,
    runIndex: options.runIndex,
    phase: options.phase,
    parallelWorkerCount: options.parallelWorkerCount,
    applicationName: options.applicationName,
    dbConcurrencyMode: options.dbConcurrencyMode,
    executionMode: options.executionMode,
  });

  try {
    await repositoryCallback(new BenchmarkRepository(client));
  } finally {
    await client.close();
  }
}

export async function runCustomerSummaryCase(options: ZtdBenchCaseOptions): Promise<void> {
  await runCase(buildCustomerSummaryFixtures(options.schemaName), async (repository) => {
    const rows = await repository.customerSummary();
    assertExpectedRows('customer-summary', rows);
  }, options);
}

export async function runProductRankingCase(options: ZtdBenchCaseOptions): Promise<void> {
  await runCase(buildProductRankingFixtures(options.schemaName), async (repository) => {
    const rows = await repository.productRanking();
    assertExpectedRows('product-ranking', rows);
  }, options);
}

export async function runSalesSummaryCase(options: ZtdBenchCaseOptions): Promise<void> {
  await runCase(buildSalesSummaryFixtures(options.schemaName), async (repository) => {
    const rows = await repository.salesSummary();
    assertExpectedRows('sales-summary', rows);
  }, options);
}
