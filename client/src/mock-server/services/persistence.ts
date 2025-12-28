/**
 * File-based Persistence Service
 *
 * Provides simple JSON file persistence for mock data
 * Uses both sync and async file operations
 */

import fs from 'fs';
import fsPromises from 'fs/promises';
import path from 'path';
import { Event } from '@/entities';

const DATA_DIR = path.join(process.cwd(), '.mock-data');
const EVENTS_FILE = path.join(DATA_DIR, 'events.json');

export interface PersistedData {
  events: Record<string, Event>;
}

/**
 * Ensure data directory exists (sync)
 */
function ensureDataDirSync(): void {
  try {
    fs.accessSync(DATA_DIR);
  } catch {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

/**
 * Ensure data directory exists (async)
 */
async function ensureDataDir(): Promise<void> {
  try {
    await fsPromises.access(DATA_DIR);
  } catch {
    await fsPromises.mkdir(DATA_DIR, { recursive: true });
  }
}

/**
 * Load data from file (synchronous - for initialization)
 */
export function loadDataSync(): PersistedData {
  ensureDataDirSync();

  try {
    const data = fs.readFileSync(EVENTS_FILE, 'utf-8');
    return JSON.parse(data);
  } catch (error) {
    // File doesn't exist or is invalid, return empty data
    return { events: {} };
  }
}

/**
 * Load data from file (async)
 */
export async function loadData(): Promise<PersistedData> {
  await ensureDataDir();

  try {
    const data = await fsPromises.readFile(EVENTS_FILE, 'utf-8');
    return JSON.parse(data);
  } catch (error) {
    // File doesn't exist or is invalid, return empty data
    return { events: {} };
  }
}

/**
 * Save data to file (async)
 */
export async function saveData(data: PersistedData): Promise<void> {
  await ensureDataDir();
  await fsPromises.writeFile(EVENTS_FILE, JSON.stringify(data, null, 2), 'utf-8');
}

/**
 * Save data to file (synchronous - for critical operations)
 */
export function saveDataSync(data: PersistedData): void {
  ensureDataDirSync();
  fs.writeFileSync(EVENTS_FILE, JSON.stringify(data, null, 2), 'utf-8');
}

/**
 * Clear all persisted data
 */
export async function clearData(): Promise<void> {
  try {
    await fsPromises.unlink(EVENTS_FILE);
  } catch {
    // File doesn't exist, nothing to do
  }
}
