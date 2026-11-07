import { create } from 'zustand';

export type UiVersion = 'classic' | 'v2';

const STORAGE_KEY = 'w2m-ui-version';
const DEFAULT_VERSION: UiVersion = 'v2';

export function parseUiVersion(value: string | null): UiVersion | null {
  return value === 'classic' || value === 'v2' ? value : null;
}

function readStoredVersion(): string | null {
  try {
    return window.localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

function storeVersion(version: UiVersion) {
  try {
    window.localStorage.setItem(STORAGE_KEY, version);
  } catch {
    // Private windows can refuse storage: the version still applies until the next reload.
  }
}

interface UiVersionState {
  version: UiVersion;
  /** Takes `location.search`. The server render always sees the default, so this runs after mount. */
  loadVersion: (search: string) => void;
  toggleVersion: () => void;
}

export const useUiVersionStore = create<UiVersionState>((set, get) => ({
  version: DEFAULT_VERSION,
  loadVersion: (search) => {
    const fromUrl = parseUiVersion(new URLSearchParams(search).get('ui'));
    if (fromUrl) storeVersion(fromUrl);
    set({ version: fromUrl ?? parseUiVersion(readStoredVersion()) ?? DEFAULT_VERSION });
  },
  toggleVersion: () => {
    const version: UiVersion = get().version === 'v2' ? 'classic' : 'v2';
    storeVersion(version);
    set({ version });
  },
}));

export function useUiVersion(): UiVersion {
  return useUiVersionStore((state) => state.version);
}

/** Matched by physical key: on macOS, Option+Shift+U reports a dead key as `key`. */
export function isUiVersionToggle(event: Pick<KeyboardEvent, 'shiftKey' | 'altKey' | 'code'>) {
  return event.shiftKey && event.altKey && event.code === 'KeyU';
}
