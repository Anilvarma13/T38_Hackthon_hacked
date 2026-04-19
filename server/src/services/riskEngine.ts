/* ═══════════════════════════════════════════════════════════════
   AEGIS-ALPHA — Core Risk Calculation Engine
   Server-side computation of patient risk scores, sepsis
   detection, delta trends, and alert generation.
═══════════════════════════════════════════════════════════════ */

export interface VitalsInput {
  bpSystolic:      number | null;
  bpDiastolic:     number | null;
  heartRate:       number | null;
  temperatureF:    number | null;
  spo2:            number | null;
  respiratoryRate: number | null;
  gcsScore:        number | null;
  clinicalNotes:   string;
}

export interface RiskFlag {
  code:       string;
  level:      'critical' | 'high' | 'moderate' | 'low';
  title:      string;
  detail:     string;
  dataPoint:  string;
  explain:    string;
}

export interface RiskResult {
  overallLevel:    'critical' | 'high' | 'moderate' | 'low' | 'none';
  stabilityScore:  number;      // 0–100 (higher = more stable)
  flags:           RiskFlag[];
  sepsisRisk:      boolean;
  sepsisScore:     number;      // qSOFA score  0–3
}

/* ─── Clinical Thresholds ─────────────────────────────────────── */
const T = {
  BP_SYS_CRIT:  160, BP_SYS_WARN:  140,
  BP_DIA_CRIT:  100, BP_DIA_WARN:   90,
  HR_HIGH_CRIT: 120, HR_HIGH_WARN:  100,
  HR_LOW_CRIT:   50, HR_LOW_WARN:    55,
  TEMP_HIGH_CRIT: 103,  TEMP_HIGH_WARN: 100.4,
  TEMP_LOW_CRIT:   96,
  SPO2_CRIT:       90,  SPO2_WARN:       94,
  RR_HIGH_CRIT:    30,  RR_HIGH_WARN:    22,
  GCS_CRIT:        13,
};

/* ─── Main Risk Evaluator ────────────────────────────────────── */
export function evaluateRisk(v: VitalsInput): RiskResult {
  const flags: RiskFlag[] = [];

  // ── Blood Pressure ──────────────────────────────────────────
  if (v.bpSystolic !== null) {
    if (v.bpSystolic >= T.BP_SYS_CRIT || (v.bpDiastolic ?? 0) >= T.BP_DIA_CRIT) {
      flags.push({
        code: 'HYPERTENSION_SEVERE', level: 'critical',
        title: 'Severe Hypertension',
        dataPoint: `BP ${v.bpSystolic}/${v.bpDiastolic} mmHg`,
        detail: `BP ${v.bpSystolic}/${v.bpDiastolic} — Stage II. Stroke/MI risk elevated.`,
        explain: `Systolic ≥160 mmHg classified as Stage II. Immediate antihypertensive required.`,
      });
    } else if (v.bpSystolic >= T.BP_SYS_WARN || (v.bpDiastolic ?? 0) >= T.BP_DIA_WARN) {
      flags.push({
        code: 'HYPERTENSION_STAGE1', level: 'moderate',
        title: 'High Blood Pressure',
        dataPoint: `BP ${v.bpSystolic}/${v.bpDiastolic} mmHg`,
        detail: `BP exceeds normal threshold (130/80). Monitor closely.`,
        explain: `Stage I hypertension. Check every 2 hours. Ensure medication compliance.`,
      });
    }
    // Hypotension
    if (v.bpSystolic < 90) {
      flags.push({
        code: 'HYPOTENSION', level: 'critical',
        title: 'Hypotension',
        dataPoint: `BP ${v.bpSystolic} mmHg systolic`,
        detail: `Systolic BP < 90 mmHg — possible shock or heart failure.`,
        explain: `Systolic <90 requires immediate fluid resuscitation and cause investigation.`,
      });
    }
  }

  // ── Heart Rate ───────────────────────────────────────────────
  if (v.heartRate !== null && v.heartRate > 0) {
    if (v.heartRate < T.HR_LOW_CRIT) {
      flags.push({
        code: 'BRADYCARDIA_SEVERE', level: 'critical',
        title: 'Bradycardia',
        dataPoint: `HR ${v.heartRate} bpm`,
        detail: `HR dangerously low. Cardiac conduction review needed.`,
        explain: `HR <50 may indicate complete heart block. Atropine/pacing may be required.`,
      });
    } else if (v.heartRate < T.HR_LOW_WARN) {
      flags.push({
        code: 'BRADYCARDIA_MILD', level: 'moderate',
        title: 'Borderline Bradycardia',
        dataPoint: `HR ${v.heartRate} bpm`,
        detail: `HR below normal range (60–100). Monitor closely.`,
        explain: `HR 50–55 is below typical resting range. Monitor for progression.`,
      });
    } else if (v.heartRate > T.HR_HIGH_CRIT) {
      flags.push({
        code: 'TACHYCARDIA_SEVERE', level: 'critical',
        title: 'Severe Tachycardia',
        dataPoint: `HR ${v.heartRate} bpm`,
        detail: `HR critically elevated. Cardiac arrhythmia or haemodynamic instability.`,
        explain: `HR >120 requires ECG, IV access, and cardiac monitoring immediately.`,
      });
    } else if (v.heartRate > T.HR_HIGH_WARN) {
      flags.push({
        code: 'TACHYCARDIA_MILD', level: 'moderate',
        title: 'Elevated Heart Rate',
        dataPoint: `HR ${v.heartRate} bpm`,
        detail: `HR above normal range. Investigate cause (pain, fever, anxiety).`,
        explain: `HR 100–120 — monitor for progression. Check fluid status and temperature.`,
      });
    }
  }

  // ── Temperature ──────────────────────────────────────────────
  if (v.temperatureF !== null && v.temperatureF > 0) {
    if (v.temperatureF >= T.TEMP_HIGH_CRIT) {
      flags.push({
        code: 'HYPERPYREXIA', level: 'critical',
        title: 'High Fever / Hyperpyrexia',
        dataPoint: `Temp ${v.temperatureF}°F`,
        detail: `Temp ≥103°F — sepsis protocol consideration.`,
        explain: `≥103°F with raised HR suggests septic process. Blood cultures + broad-spectrum antibiotics.`,
      });
    } else if (v.temperatureF >= T.TEMP_HIGH_WARN) {
      flags.push({
        code: 'FEVER', level: 'moderate',
        title: 'Fever Detected',
        dataPoint: `Temp ${v.temperatureF}°F`,
        detail: `Temperature above threshold (100.4°F). Active fever.`,
        explain: `Fever threshold met. Administer antipyretics. Identify infection source.`,
      });
    } else if (v.temperatureF < T.TEMP_LOW_CRIT) {
      flags.push({
        code: 'HYPOTHERMIA', level: 'critical',
        title: 'Hypothermia',
        dataPoint: `Temp ${v.temperatureF}°F`,
        detail: `Core temperature critically low. Risk of cardiac arrest.`,
        explain: `<96°F is life-threatening. Apply external warming, avoid rough handling.`,
      });
    }
  }

  // ── SpO2 ────────────────────────────────────────────────────
  if (v.spo2 !== null) {
    if (v.spo2 < T.SPO2_CRIT) {
      flags.push({
        code: 'HYPOXIA_SEVERE', level: 'critical',
        title: 'Severe Hypoxia',
        dataPoint: `SpO₂ ${v.spo2}%`,
        detail: `SpO₂ <90% — immediate oxygen therapy required.`,
        explain: `SpO₂ <90 is a medical emergency. High-flow O₂ or NIV/intubation may be needed.`,
      });
    } else if (v.spo2 < T.SPO2_WARN) {
      flags.push({
        code: 'HYPOXIA_MILD', level: 'high',
        title: 'Hypoxia Detected',
        dataPoint: `SpO₂ ${v.spo2}%`,
        detail: `SpO₂ 90–93% — supplemental oxygen indicated.`,
        explain: `Target SpO₂ ≥94%. Apply 2–4L O₂ via nasal cannula and reassess in 15 mins.`,
      });
    }
  }

  // ── Respiratory Rate ─────────────────────────────────────────
  if (v.respiratoryRate !== null) {
    if (v.respiratoryRate >= T.RR_HIGH_CRIT) {
      flags.push({
        code: 'TACHYPNOEA_SEVERE', level: 'critical',
        title: 'Severe Tachypnoea',
        dataPoint: `RR ${v.respiratoryRate} breaths/min`,
        detail: `RR ≥30 — respiratory failure risk.`,
        explain: `Critical respiratory rate. ABG, chest assessment, and respiratory team involvement.`,
      });
    } else if (v.respiratoryRate >= T.RR_HIGH_WARN) {
      flags.push({
        code: 'TACHYPNOEA_MILD', level: 'moderate',
        title: 'Elevated Respiratory Rate',
        dataPoint: `RR ${v.respiratoryRate} breaths/min`,
        detail: `RR 22–29 — early respiratory distress pattern.`,
        explain: `Monitor response to O₂ therapy, check for infection or metabolic cause.`,
      });
    }
  }

  // ── GCS ─────────────────────────────────────────────────────
  if (v.gcsScore !== null && v.gcsScore < T.GCS_CRIT) {
    flags.push({
      code: 'REDUCED_CONSCIOUSNESS', level: 'critical',
      title: 'Altered Consciousness',
      dataPoint: `GCS ${v.gcsScore}/15`,
      detail: `GCS <13 — neurological emergency.`,
      explain: `GCS <13 requires immediate neurological assessment and airway protection.`,
    });
  }

  // ── qSOFA Sepsis Screening ───────────────────────────────────
  let sepsisScore = 0;
  if ((v.bpSystolic ?? 999) < 100)            sepsisScore++;
  if ((v.respiratoryRate ?? 0) >= 22)          sepsisScore++;
  if ((v.gcsScore ?? 15) < 15)                 sepsisScore++;
  const sepsisRisk = sepsisScore >= 2;

  if (sepsisRisk && (v.temperatureF ?? 0) >= 100.4) {
    flags.push({
      code: 'SEPSIS_RISK', level: 'critical',
      title: '⚠ Sepsis Risk — qSOFA ≥2',
      dataPoint: `qSOFA ${sepsisScore}/3`,
      detail: `Multiple systemic inflammatory indicators. Sepsis bundle required.`,
      explain: `qSOFA ≥2 with fever: initiate Sepsis-6 bundle — lactate, blood cultures, IV fluids, broad antibiotics.`,
    });
  }

  // ── Clinical Notes — Semantic Gap Flags ─────────────────────
  const notes = (v.clinicalNotes ?? '').toLowerCase();
  if ((notes.includes('chest pain') || notes.includes('chest tightness')))
    flags.push({
      code: 'SEMANTIC_GAP_CARDIAC', level: 'moderate',
      title: 'Info Gap: Cardiac Keywords',
      dataPoint: 'Clinical Notes',
      detail: 'Notes mention chest pain without cardiac investigation flagged.',
      explain: 'Ensure ECG, troponin, and D-dimer are ordered/recorded.',
    });

  // ── Stability Score ──────────────────────────────────────────
  let score = 100;
  flags.forEach(f => {
    if (f.level === 'critical')  score -= 22;
    else if (f.level === 'high') score -= 15;
    else if (f.level === 'moderate') score -= 10;
    else score -= 4;
  });
  const stabilityScore = Math.max(0, Math.min(100, score));

  // ── Overall Level ────────────────────────────────────────────
  const hasCritical  = flags.some(f => f.level === 'critical');
  const hasHigh      = flags.some(f => f.level === 'high');
  const hasModerate  = flags.some(f => f.level === 'moderate');

  const overallLevel =
    hasCritical  ? 'critical'  :
    sepsisRisk   ? 'critical'  :
    hasHigh      ? 'high'      :
    hasModerate  ? 'moderate'  :
    flags.length > 0 ? 'low'   : 'none';

  return { overallLevel, stabilityScore, flags, sepsisRisk, sepsisScore };
}

/* ─── Delta / Trend Calculator ───────────────────────────────── */
export interface VitalsSnapshot {
  bpSystolic:   number | null;
  heartRate:    number | null;
  temperatureF: number | null;
  spo2:         number | null;
  createdAt:    Date;
}

export interface TrendReport {
  field:          string;
  current:        number | null;
  previous:       number | null;
  deltaAbs:       number | null;   // absolute change
  deltaPct:       number | null;   // percentage change
  trend:          'rising' | 'falling' | 'stable' | 'n/a';
  isClinicallySignificant: boolean;
}

export function calculateTrend(
  current: VitalsSnapshot,
  previous: VitalsSnapshot
): TrendReport[] {
  const fields: Array<{ key: keyof VitalsSnapshot; label: string; sigThreshold: number }> = [
    { key: 'bpSystolic',   label: 'Blood Pressure (Systolic)', sigThreshold: 10 },
    { key: 'heartRate',    label: 'Heart Rate',                 sigThreshold: 10 },
    { key: 'temperatureF', label: 'Temperature',               sigThreshold: 0.5 },
    { key: 'spo2',         label: 'SpO₂',                      sigThreshold: 2 },
  ];

  return fields.map(({ key, label, sigThreshold }) => {
    const curr = current[key] as number | null;
    const prev = previous[key] as number | null;

    if (curr === null || prev === null)
      return { field: label, current: curr, previous: prev,
        deltaAbs: null, deltaPct: null, trend: 'n/a', isClinicallySignificant: false };

    const deltaAbs = curr - prev;
    const deltaPct = prev !== 0 ? (deltaAbs / prev) * 100 : 0;
    const trend: TrendReport['trend'] =
      deltaAbs > 0.1 ? 'rising' : deltaAbs < -0.1 ? 'falling' : 'stable';

    return {
      field: label, current: curr, previous: prev,
      deltaAbs: Math.round(deltaAbs * 10) / 10,
      deltaPct: Math.round(deltaPct * 10) / 10,
      trend,
      isClinicallySignificant: Math.abs(deltaAbs) >= sigThreshold,
    };
  });
}

/* ─── Stale Vitals Checker ───────────────────────────────────── */
export function isVitalsStale(lastRecordedAt: Date, thresholdHours = 4): boolean {
  const msSince = Date.now() - lastRecordedAt.getTime();
  return msSince > thresholdHours * 60 * 60 * 1000;
}

/* ─── Medication Reconciliation ──────────────────────────────── */
export interface PrescribedMed {
  id: string; drugName: string; dosage: string; frequency: string;
}
export interface AdminMed {
  prescribedMedId: string | null; drugName: string; dosageGiven: string;
}

export interface ReconciliationResult {
  hasDiscrepancies: boolean;
  missing: PrescribedMed[];       // prescribed but NOT administered
  extra:   AdminMed[];            // administered but NOT prescribed
  dosageMismatches: Array<{ prescribed: PrescribedMed; administered: AdminMed }>;
}

export function reconcileMedications(
  prescribed: PrescribedMed[],
  administered: AdminMed[]
): ReconciliationResult {
  const adminMap = new Map(administered.map(a => [a.prescribedMedId, a]));

  const missing = prescribed.filter(p => !adminMap.has(p.id));
  const extra   = administered.filter(a => !a.prescribedMedId ||
    !prescribed.find(p => p.id === a.prescribedMedId));

  const dosageMismatches = prescribed
    .filter(p => adminMap.has(p.id))
    .filter(p => {
      const adm = adminMap.get(p.id)!;
      return adm.dosageGiven.toLowerCase() !== p.dosage.toLowerCase();
    })
    .map(p => ({ prescribed: p, administered: adminMap.get(p.id)! }));

  return {
    hasDiscrepancies: missing.length > 0 || extra.length > 0 || dosageMismatches.length > 0,
    missing, extra, dosageMismatches,
  };
}
