import {
  runCustomerSummaryCase,
  runProductRankingCase,
  runSalesSummaryCase,
} from '../ztd-bench/tests/support/ztd-bench-cases';
import { TRADITIONAL_CASES } from '../support/traditional-bench-data';

export const TRADITIONAL_CASE_COUNT = TRADITIONAL_CASES.length;

export const ZTD_CASE_RUNNERS = [
  { caseName: 'customer-summary', runner: runCustomerSummaryCase },
  { caseName: 'product-ranking', runner: runProductRankingCase },
  { caseName: 'sales-summary', runner: runSalesSummaryCase },
];
