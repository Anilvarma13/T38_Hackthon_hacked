const MAX = {
  short: 500,
  medium: 4000,
  long: 20000,
};

export function sanitizeText(input: unknown, maxLen: number): string {
  if (input == null) return '';
  let s = String(input).trim().replace(/\0/g, '');
  if (!s) return '';
  s = s.replace(/<[^>]*>/g, '');
  if (s.length > maxLen) s = s.slice(0, maxLen);
  return s;
}

export function sanitizePatientName(name: unknown): string {
  const s = sanitizeText(name, MAX.short);
  return s || 'Unknown Patient';
}

export function sanitizeRiskScore(score: unknown): string {
  const raw = String(score || 'LOW').toUpperCase().trim();
  const allowed = new Set(['LOW', 'MODERATE', 'MEDIUM', 'HIGH', 'CRITICAL']);
  return allowed.has(raw) ? raw : 'LOW';
}

export function normalizeMissedActions(items: unknown): string[] {
  if (!Array.isArray(items)) return [];
  const out: string[] = [];
  for (const item of items) {
    if (typeof item === 'string') {
      const t = sanitizeText(item, MAX.medium);
      if (t) out.push(t);
    } else if (item && typeof item === 'object') {
      const o = item as { task?: string; reason?: string };
      const line = [o.task, o.reason].filter(Boolean).join(' — ');
      const t = sanitizeText(line, MAX.medium);
      if (t) out.push(t);
    }
  }
  return out.slice(0, 50);
}
