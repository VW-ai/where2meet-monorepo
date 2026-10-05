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

export interface Registration {
  email: string;
  password: string;
  name?: string;
}

export type ProfilePatch = Partial<
  Pick<
    AccountProfile,
    "name" | "avatarUrl" | "defaultAddress" | "defaultPlaceId" | "defaultFuzzyLocation"
  >
>;

export interface AccountSession {
  user: AccountProfile;
  expiresAt: Date;
}

export interface IssuedSession extends AccountSession {
  credential: string;
  lifetimeSeconds: number;
}

export interface Accounts {
  register(input: Registration): Promise<IssuedSession>;
  login(input: Pick<Registration, "email" | "password">): Promise<IssuedSession>;
  session(credential: string): Promise<AccountSession>;
  logout(credential?: string): Promise<void>;
  updateProfile(input: { userId: string; patch: ProfilePatch }): Promise<AccountProfile>;
}
