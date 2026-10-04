export interface AccountProfile {
  id: string;
  email: string;
  name: string | null;
  avatarUrl: string | null;
  emailVerified: boolean;
  defaultAddress: string | null;
  defaultPlaceId: string | null;
  defaultFuzzyLocation: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface Accounts {
  session(credential: string): Promise<{ user: AccountProfile; expiresAt: Date }>;
}
