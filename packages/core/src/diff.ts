const PATCH_SENTINEL = '$patch';

export interface Patch {
  $patch: true;
  [key: string]: unknown;
}

export function isPatch(value: unknown): value is Patch {
  return typeof value === 'object' && value !== null
    && (value as Record<string, unknown>)[PATCH_SENTINEL] === true;
}

export function diff<T extends Record<string, unknown>>(prev: T, next: T): Patch | T {
  if (typeof prev !== typeof next || Array.isArray(prev) || Array.isArray(next)) {
    return next;
  }

  const changed: Record<string, unknown> = { [PATCH_SENTINEL]: true as const };
  let hasChanges = false;

  const allKeys = new Set([...Object.keys(prev), ...Object.keys(next)]);

  for (const key of allKeys) {
    if (key === PATCH_SENTINEL) continue;
    if (prev[key] !== next[key]) {
      changed[key] = next[key];
      hasChanges = true;
    }
  }

  return hasChanges ? (changed as Patch) : prev;
}

export function apply<T extends Record<string, unknown>>(state: T, patch: Patch | T): T {
  if (!isPatch(patch)) return patch as unknown as T;

  const result = { ...state } as Record<string, unknown>;
  for (const key of Object.keys(patch)) {
    if (key === PATCH_SENTINEL) continue;
    if (patch[key] === undefined) {
      delete result[key];
    } else {
      result[key] = patch[key];
    }
  }
  return result as unknown as T;
}
