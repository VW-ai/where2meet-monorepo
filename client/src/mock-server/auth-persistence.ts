import fs from 'fs/promises';
import path from 'path';
import bcrypt from 'bcryptjs';
import { randomBytes } from 'crypto';
import {
  UsersData,
  SessionsData,
  UserEventsData,
  PasswordResetTokensData,
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
  data: UsersData | SessionsData | UserEventsData | PasswordResetTokensData
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
};
