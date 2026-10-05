export interface ProviderCache {
  read(key: string, signal: AbortSignal): Promise<string | null>;
  write(key: string, value: string, ttlSeconds: number, signal: AbortSignal): Promise<void>;
}
