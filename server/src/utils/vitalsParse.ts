export function extractFirstNumber(value: unknown): number | undefined {
  if (value == null) return undefined;
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  const str = String(value);
  const m = str.match(/-?\d+\.?\d*/);
  if (!m) return undefined;
  const n = parseFloat(m[0]);
  return Number.isFinite(n) ? n : undefined;
}

/** Prefer systolic from "120/80" patterns. */
export function parseBloodPressure(value: unknown): number | undefined {
  if (value == null) return undefined;
  const str = String(value);
  const ratio = str.match(/(\d{2,3})\s*\/\s*(\d{2,3})/);
  if (ratio) {
    const sys = parseInt(ratio[1], 10);
    return Number.isFinite(sys) ? sys : undefined;
  }
  return extractFirstNumber(value);
}
