import fs from 'fs/promises';
import path from 'path';
import bcrypt from 'bcryptjs';
import { randomBytes } from 'crypto';
import {
  UsersData,
  SessionsData,
  UserEventsData,
  PasswordResetTokensData,
  OAuthStatesData,
  OAuthState,
} from '@/features/auth/types';

const MOCK_DATA_DIR = path.join(process.cwd(), '.mock-data');

// Ensure mock data files exist
async function ensureFile(filename: string, defaultData: Record<string, unknown>) {
  const filepath = path.join(MOCK_DATA_DIR, filename);
  try {
    await fs.access(filepath);
  } catch {
    await fs.writeFile(filepath, JSON.stringify(defaultData, null, 2));
  }
}

// Read/write helpers
async function readJSON(filename: string) {
  const filepath = path.join(MOCK_DATA_DIR, filename);
  const data = await fs.readFile(filepath, 'utf-8');
  return JSON.parse(data);
}

async function writeJSON(
  filename: string,
  data: UsersData | SessionsData | UserEventsData | PasswordResetTokensData | OAuthStatesData
) {
  const filepath = path.join(MOCK_DATA_DIR, filename);
  await fs.writeFile(filepath, JSON.stringify(data, null, 2));
}

export const authPersistence = {
  // Users
  async getUsers() {
    await ensureFile('users.json', { users: {}, identities: {} });
    return readJSON('users.json');
  },

  async saveUsers(data: UsersData) {
    await writeJSON('users.json', data);
  },

  // Sessions
  async getSessions() {
    await ensureFile('sessions.json', { sessions: {} });
    return readJSON('sessions.json');
  },

  async saveSessions(data: SessionsData) {
    await writeJSON('sessions.json', data);
  },

  // User Events
  async getUserEvents() {
    await ensureFile('user-events.json', { userEvents: {} });
    return readJSON('user-events.json');
  },

  async saveUserEvents(data: UserEventsData) {
    await writeJSON('user-events.json', data);
  },

  // Password Reset Tokens
  async getResetTokens() {
    await ensureFile('password-reset-tokens.json', { tokens: {} });
    return readJSON('password-reset-tokens.json');
  },

  async saveResetTokens(data: PasswordResetTokensData) {
    await writeJSON('password-reset-tokens.json', data);
  },

  // OAuth States
  async getOAuthStates() {
    await ensureFile('oauth-states.json', { states: {} });
    return readJSON('oauth-states.json');
  },

  async saveOAuthStates(data: OAuthStatesData) {
    await writeJSON('oauth-states.json', data);
  },

  // Helpers
  generateId(prefix: string) {
    return `${prefix}_${randomBytes(16).toString('hex')}`;
  },

  async hashPassword(password: string) {
    return bcrypt.hash(password, 12);
  },

  async verifyPassword(password: string, hash: string) {
    return bcrypt.compare(password, hash);
  },

  generateSessionToken() {
    return randomBytes(32).toString('hex');
  },

  generateOAuthState() {
    return randomBytes(32).toString('hex');
  },

  async createOAuthState(provider: 'google' | 'github', redirectUrl: string) {
    const stateId = this.generateId('state');
    const stateToken = this.generateOAuthState();
    const now = new Date();
    const expiresAt = new Date(now.getTime() + 10 * 60 * 1000); // 10 minutes

    const oauthState = {
      id: stateId,
      provider,
      state: stateToken,
      redirectUrl,
      expiresAt: expiresAt.toISOString(),
      createdAt: now.toISOString(),
    };

    const data = await this.getOAuthStates();
    data.states[stateId] = oauthState;
    await this.saveOAuthStates(data);

    return oauthState;
  },

  async validateOAuthState(stateToken: string, provider: 'google' | 'github') {
    const data = (await this.getOAuthStates()) as OAuthStatesData;
    const state = Object.values(data.states).find(
      (s: OAuthState) => s.state === stateToken && s.provider === provider
    );

    if (!state) {
      return null;
    }

    // Check if expired
    if (new Date(state.expiresAt) < new Date()) {
      // Delete expired state
      delete data.states[state.id];
      await this.saveOAuthStates(data);
      return null;
    }

    return state;
  },

  async deleteOAuthState(stateId: string) {
    const data = await this.getOAuthStates();
    delete data.states[stateId];
    await this.saveOAuthStates(data);
  },
};
