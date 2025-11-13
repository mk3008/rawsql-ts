export interface Customer {
  id: number;
  email: string;
  displayName: string;
  tier: string;
  suspendedAt: Date | null;
}
