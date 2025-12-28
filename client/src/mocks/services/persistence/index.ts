import fs from 'fs';
import fsPromises from 'fs/promises';
import path from 'path';

const DATA_DIR = path.join(process.cwd(), '.mock-data');

/**
 * Generic file-based persistence utility for mock data
 *
 * Provides both sync and async file operations:
 * - Async operations for non-critical paths (fire-and-forget updates)
 * - Sync operations for critical paths (ensuring immediate availability)
 *
 * Auto-creates `.mock-data` directory and data files with default values
 *
 * @example
 * const usersPersistence = new FilePersistence('users.json', { users: {}, identities: {} });
 * await usersPersistence.write({ users: { ... }, identities: { ... } });
 * const data = await usersPersistence.read();
 */
export class FilePersistence<T> {
  private filepath: string;
  private defaultData: T;

  constructor(filename: string, defaultData: T) {
    this.filepath = path.join(DATA_DIR, filename);
    this.defaultData = defaultData;
  }

  /**
   * Read data asynchronously
   * Returns default data if file doesn't exist or is corrupted
   */
  async read(): Promise<T> {
    try {
      await this.ensureFile();
      const data = await fsPromises.readFile(this.filepath, 'utf-8');
      return JSON.parse(data);
    } catch (error) {
      console.warn(`Failed to read ${this.filepath}, using default data:`, error);
      return this.defaultData;
    }
  }

  /**
   * Read data synchronously
   * Returns default data if file doesn't exist or is corrupted
   */
  readSync(): T {
    try {
      this.ensureFileSync();
      const data = fs.readFileSync(this.filepath, 'utf-8');
      return JSON.parse(data);
    } catch (error) {
      console.warn(`Failed to read ${this.filepath}, using default data:`, error);
      return this.defaultData;
    }
  }

  /**
   * Write data asynchronously
   */
  async write(data: T): Promise<void> {
    try {
      await this.ensureFile();
      await fsPromises.writeFile(this.filepath, JSON.stringify(data, null, 2), 'utf-8');
    } catch (error) {
      console.error(`Failed to write to ${this.filepath}:`, error);
      throw error;
    }
  }

  /**
   * Write data synchronously
   * Use for critical operations that must complete before proceeding
   */
  writeSync(data: T): void {
    try {
      this.ensureFileSync();
      fs.writeFileSync(this.filepath, JSON.stringify(data, null, 2), 'utf-8');
    } catch (error) {
      console.error(`Failed to write to ${this.filepath}:`, error);
      throw error;
    }
  }

  /**
   * Clear persisted data (reset to default)
   */
  async clear(): Promise<void> {
    await this.write(this.defaultData);
  }

  /**
   * Clear persisted data synchronously
   */
  clearSync(): void {
    this.writeSync(this.defaultData);
  }

  /**
   * Ensure data directory and file exist (async)
   */
  private async ensureFile(): Promise<void> {
    try {
      await fsPromises.access(DATA_DIR);
    } catch {
      await fsPromises.mkdir(DATA_DIR, { recursive: true });
    }

    try {
      await fsPromises.access(this.filepath);
    } catch {
      await this.write(this.defaultData);
    }
  }

  /**
   * Ensure data directory and file exist (sync)
   */
  private ensureFileSync(): void {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }

    if (!fs.existsSync(this.filepath)) {
      this.writeSync(this.defaultData);
    }
  }
}

/**
 * Singleton persistence instances for common data types
 * These can be imported and used directly without creating new instances
 */
export const usersPersistence = new FilePersistence('users.json', {
  users: {},
  identities: {},
});

export const sessionsPersistence = new FilePersistence('sessions.json', {
  sessions: {},
});

export const eventsPersistence = new FilePersistence('events.json', {
  events: {},
});

export const userEventsPersistence = new FilePersistence('user-events.json', {
  userEvents: {},
});

export const passwordResetTokensPersistence = new FilePersistence('password-reset-tokens.json', {
  tokens: {},
});

export const oauthStatesPersistence = new FilePersistence('oauth-states.json', {
  states: {},
});
