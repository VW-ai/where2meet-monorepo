export type Schema<T> = (value: unknown, path: string) => T;

export type Infer<S extends Schema<unknown>> = ReturnType<S>;

function fail(path: string, expected: string, value: unknown): never {
  const actual = value === null ? 'null' : Array.isArray(value) ? 'array' : typeof value;
  throw new Error(`${path || 'payload'}: expected ${expected}, got ${actual}`);
}

function at(path: string, key: string | number): string {
  return path ? `${path}.${key}` : String(key);
}

export const string: Schema<string> = (value, path) =>
  typeof value === 'string' ? value : fail(path, 'string', value);

export const number: Schema<number> = (value, path) =>
  typeof value === 'number' ? value : fail(path, 'number', value);

export const boolean: Schema<boolean> = (value, path) =>
  typeof value === 'boolean' ? value : fail(path, 'boolean', value);

export function nullable<T>(schema: Schema<T>): Schema<T | null> {
  return (value, path) => (value === null ? null : schema(value, path));
}

export function array<T>(item: Schema<T>): Schema<T[]> {
  return (value, path) =>
    Array.isArray(value)
      ? value.map((entry, i) => item(entry, at(path, i)))
      : fail(path, 'array', value);
}

export function object<Shape extends Record<string, Schema<unknown>>>(
  shape: Shape
): Schema<{ [K in keyof Shape]: Infer<Shape[K]> }> {
  return (value, path) => {
    if (typeof value !== 'object' || value === null || Array.isArray(value)) {
      return fail(path, 'object', value);
    }
    const fields = value as Record<string, unknown>;
    const result: Record<string, unknown> = {};
    for (const key of Object.keys(shape)) result[key] = shape[key](fields[key], at(path, key));
    return result as { [K in keyof Shape]: Infer<Shape[K]> };
  };
}
