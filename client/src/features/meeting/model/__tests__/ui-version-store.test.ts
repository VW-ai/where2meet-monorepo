import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { isUiVersionToggle, parseUiVersion, useUiVersionStore } from '../ui-version-store';

describe('parseUiVersion', () => {
  it('accepts the two versions', () => {
    expect(parseUiVersion('classic')).toBe('classic');
    expect(parseUiVersion('v2')).toBe('v2');
  });

  it('rejects anything else', () => {
    expect(parseUiVersion('V2')).toBeNull();
    expect(parseUiVersion('')).toBeNull();
    expect(parseUiVersion(null)).toBeNull();
  });
});

describe('version precedence', () => {
  let stored: Record<string, string>;

  beforeEach(() => {
    stored = {};
    vi.stubGlobal('window', {
      localStorage: {
        getItem: (key: string) => stored[key] ?? null,
        setItem: (key: string, value: string) => {
          stored[key] = value;
        },
      },
    });
    useUiVersionStore.setState({ version: 'v2' });
  });

  afterEach(() => vi.unstubAllGlobals());

  const load = (search: string) => {
    useUiVersionStore.getState().loadVersion(search);
    return useUiVersionStore.getState().version;
  };

  it('defaults to v2', () => {
    expect(load('')).toBe('v2');
  });

  it('uses the saved version when the URL has none', () => {
    stored['w2m-ui-version'] = 'classic';
    expect(load('')).toBe('classic');
  });

  it('lets the URL win over the saved version, and saves it', () => {
    stored['w2m-ui-version'] = 'v2';
    expect(load('?ui=classic')).toBe('classic');
    expect(stored['w2m-ui-version']).toBe('classic');
    expect(load('')).toBe('classic');
  });

  it('ignores an unknown URL value and an unknown saved value', () => {
    stored['w2m-ui-version'] = 'classic';
    expect(load('?ui=v3')).toBe('classic');
    stored['w2m-ui-version'] = 'v3';
    expect(load('')).toBe('v2');
  });

  it('still works when storage throws', () => {
    vi.stubGlobal('window', {
      localStorage: {
        getItem: () => {
          throw new Error('denied');
        },
        setItem: () => {
          throw new Error('denied');
        },
      },
    });
    expect(load('?ui=classic')).toBe('classic');
    expect(load('')).toBe('v2');
  });

  it('flips and saves on toggle', () => {
    useUiVersionStore.getState().toggleVersion();
    expect(useUiVersionStore.getState().version).toBe('classic');
    expect(stored['w2m-ui-version']).toBe('classic');
    useUiVersionStore.getState().toggleVersion();
    expect(useUiVersionStore.getState().version).toBe('v2');
  });
});

describe('isUiVersionToggle', () => {
  it('matches Shift+Alt+U by physical key', () => {
    expect(isUiVersionToggle({ shiftKey: true, altKey: true, code: 'KeyU' })).toBe(true);
  });

  it('ignores the same key without both modifiers', () => {
    expect(isUiVersionToggle({ shiftKey: true, altKey: false, code: 'KeyU' })).toBe(false);
    expect(isUiVersionToggle({ shiftKey: false, altKey: true, code: 'KeyU' })).toBe(false);
    expect(isUiVersionToggle({ shiftKey: true, altKey: true, code: 'KeyI' })).toBe(false);
  });
});
