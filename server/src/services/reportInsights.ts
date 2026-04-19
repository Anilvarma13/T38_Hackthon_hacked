import mongoose from 'mongoose';
import { PatientReport, type IVitalsNumeric } from '../models/PatientReport';

const vitalKeys = ['hemoglobin', 'blood_pressure', 'sugar', 'oxygen', 'heart_rate'] as const;

function patientKey(name: string): string {
  return name.trim().toLowerCase();
}

export async function compareTwoReports(
  currentId: string,
  baselineId: string
): Promise<{
  current: unknown;
  baseline: unknown;
  vitals_delta: Record<string, { before?: number; after?: number; change?: number }>;
  risk_changed: boolean;
  summary: string;
} | null> {
  if (!mongoose.isValidObjectId(currentId) || !mongoose.isValidObjectId(baselineId)) return null;
  const [current, baseline] = await Promise.all([
    PatientReport.findById(currentId).lean(),
    PatientReport.findById(baselineId).lean(),
  ]);
  if (!current || !baseline) return null;

  const vitals_delta: Record<string, { before?: number; after?: number; change?: number }> = {};
  const bv = baseline.vitals || {};
  const cv = current.vitals || {};
  for (const k of vitalKeys) {
    const before = bv[k];
    const after = cv[k];
    if (before === undefined && after === undefined) continue;
    vitals_delta[k] = {
      before,
      after,
      change:
        typeof before === 'number' && typeof after === 'number' ? after - before : undefined,
    };
  }

  const risk_changed = baseline.risk_score !== current.risk_score;
  const summary = risk_changed
    ? `Risk level moved from ${baseline.risk_score} to ${current.risk_score}.`
    : `Risk level remains ${current.risk_score}. Review vitals_delta for numeric shifts.`;

  return {
    current,
    baseline,
    vitals_delta,
    risk_changed,
    summary,
  };
}

export async function trendsForPatient(patientName: string): Promise<{
  patient_name: string;
  points: Array<{
    report_id: string;
    created_at: Date;
    vitals: IVitalsNumeric;
    risk_score: string;
  }>;
} | null> {
  const key = patientKey(patientName);
  if (!key) return null;

  const reports = await PatientReport.find({
    patient_name: new RegExp(`^${escapeRegex(patientName.trim())}$`, 'i'),
  })
    .sort({ created_at: 1 })
    .select('vitals risk_score created_at')
    .lean();

  if (!reports.length) return null;

  return {
    patient_name: reports[reports.length - 1]?.patient_name || patientName.trim(),
    points: reports.map((r) => ({
      report_id: String(r._id),
      created_at: r.created_at,
      vitals: r.vitals,
      risk_score: r.risk_score,
    })),
  };
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export async function recurringRisksForReport(reportId: string): Promise<{
  recurring: Array<{ type: string; count: number; severities: string[] }>;
} | null> {
  if (!mongoose.isValidObjectId(reportId)) return null;
  const report = await PatientReport.findById(reportId).lean();
  if (!report) return null;

  const history = await PatientReport.find({
    patient_name: new RegExp(`^${escapeRegex(report.patient_name.trim())}$`, 'i'),
  })
    .select('risks created_at')
    .lean();

  const typeCount = new Map<string, { count: number; severities: Set<string> }>();
  for (const h of history) {
    for (const r of h.risks || []) {
      const t = (r.type || 'Unknown').trim() || 'Unknown';
      const cur = typeCount.get(t) || { count: 0, severities: new Set<string>() };
      cur.count += 1;
      if (r.severity) cur.severities.add(r.severity);
      typeCount.set(t, cur);
    }
  }

  const recurring = [...typeCount.entries()]
    .filter(([, v]) => v.count >= 2)
    .map(([type, v]) => ({
      type,
      count: v.count,
      severities: [...v.severities],
    }))
    .sort((a, b) => b.count - a.count);

  return { recurring };
}
