import { customerSummarySql } from '../sql/customer_summary';
import { CustomerSummaryRepositoryClient } from './CustomerSummaryRepositoryClient';
import { CustomerSummaryRow } from './CustomerSummaryRow';

/** Repository that exposes customer summary aggregations without any additional inputs. */
export class CustomerSummaryRepository {
  constructor(private readonly client: CustomerSummaryRepositoryClient) {}

  customerSummary(): Promise<CustomerSummaryRow[]> {
    return this.client.query<CustomerSummaryRow>(customerSummarySql);
  }
}
