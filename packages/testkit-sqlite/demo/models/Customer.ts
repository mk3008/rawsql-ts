export type SubscriptionTier = "free" | "pro";

export interface Customer {
  id: number;
  email: string;
  displayName: string;
  tier: SubscriptionTier;
  suspendedAt: Date | null;
}
