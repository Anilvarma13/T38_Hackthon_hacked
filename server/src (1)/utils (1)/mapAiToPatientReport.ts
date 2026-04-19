import {
  sanitizePatientName,
  sanitizeRiskScore,
  sanitizeText,
  normalizeMissedActions,
} from './reportSanitize';
import { extractFirstNumber, parseBloodPressure } from './vitalsParse';
import type { ICriticalAlert, IRiskItem, IVitalsNumeric } from '../models/PatientReport';

export interface AiStructuredShape {
  patientInfo?: {
    name?: string;
    age?: number | string;
    gender?: string;
    reportDate?: string;
  };
  medicalData?: Record<string, unknown>;
  riskAssessment?: { score?: string; reasons?: string[] };
  criticalAlerts?: Array<{
    title?: string;
    dataPoint?: string;
    explanation?: string;
    level?: string;
  }>;
  missedActions?: unknown[];
  trends?: unknown[];
  aiSummary?: string;
  error?: string;
}

function buildRisks(data: AiStructuredShape): IRiskItem[] {
  const risks: IRiskItem[] = [];
  const alerts = data.criticalAlerts || [];
  for (const a of alerts) {
    const level = String(a.level || 'warning').toLowerCase();
    const severity =
      level === 'critical' ? 'CRITICAL' : level === 'warning' ? 'HIGH' : 'MODERATE';
    risks.push({
      type: sanitizeText(a.title, 200) || 'Alert',
      severity,
      value: sanitizeText(a.dataPoint, 300),
      normal_range: '',
      explanation: sanitizeText(a.explanation, 2000),
    });
  }
  const reasons = data.riskAssessment?.reasons || [];
  for (const r of reasons) {
    const text = sanitizeText(r, 2000);
    if (!text) continue;
    risks.push({
      type: 'Clinical risk factor',
      severity: sanitizeRiskScore(data.riskAssessment?.score),
      value: '',
      normal_range: '',
      explanation: text,
    });
  }
  return risks.slice(0, 100);
}

function buildCriticalAlerts(data: AiStructuredShape): ICriticalAlert[] {
  const alerts = data.criticalAlerts || [];
  return alerts
    .map((a) => ({
      title: sanitizeText(a.title, 200),
      dataPoint: sanitizeText(a.dataPoint, 300),
      explanation: sanitizeText(a.explanation, 2000),
      level: sanitizeText(a.level, 32) || 'warning',
    }))
    .filter((a) => a.title || a.explanation);
}

export function mapAiStructuredToPatientReport(data: AiStructuredShape) {
  const md = data.medicalData || {};
  const hemoglobin = extractFirstNumber(md.hemoglobin);
  const blood_pressure = parseBloodPressure(md.bloodPressure);
  const sugar = extractFirstNumber(md.sugarLevel);
  const oxygen = extractFirstNumber(md.oxygenLevel);
  const heart_rate = extractFirstNumber(md.heartRate);

  const vitals: IVitalsNumeric = {};
  if (hemoglobin !== undefined) vitals.hemoglobin = hemoglobin;
  if (blood_pressure !== undefined) vitals.blood_pressure = blood_pressure;
  if (sugar !== undefined) vitals.sugar = sugar;
  if (oxygen !== undefined) vitals.oxygen = oxygen;
  if (heart_rate !== undefined) vitals.heart_rate = heart_rate;

  const clinical_snapshot = {
    hemoglobin: sanitizeText(md.hemoglobin, 500) || undefined,
    blood_pressure: sanitizeText(md.bloodPressure, 500) || undefined,
    sugar: sanitizeText(md.sugarLevel, 500) || undefined,
    oxygen: sanitizeText(md.oxygenLevel, 500) || undefined,
    heart_rate: sanitizeText(md.heartRate, 500) || undefined,
    cholesterol: sanitizeText(md.cholesterol, 500) || undefined,
    diagnosis: sanitizeText(md.diagnosis, 4000) || undefined,
    notes: sanitizeText(md.notes, 8000) || undefined,
    prescriptions: Array.isArray(md.prescriptions)
      ? (md.prescriptions as unknown[])
          .map((p) => sanitizeText(p, 500))
          .filter(Boolean)
          .slice(0, 50)
      : [],
    recommended_tests: Array.isArray(md.recommendedTests)
      ? (md.recommendedTests as unknown[])
          .map((p) => sanitizeText(p, 500))
          .filter(Boolean)
          .slice(0, 50)
      : [],
  };

  const hasClinical =
    Object.values(clinical_snapshot).some((v) =>
      Array.isArray(v) ? v.length > 0 : Boolean(v)
    );

  return {
    patient_name: sanitizePatientName(data.patientInfo?.name),
    age: sanitizeText(data.patientInfo?.age, 32),
    gender: sanitizeText(data.patientInfo?.gender, 64),
    report_date: sanitizeText(data.patientInfo?.reportDate, 64),
    vitals,
    clinical_snapshot: hasClinical ? clinical_snapshot : undefined,
    risks: buildRisks(data),
    missed_actions: normalizeMissedActions(data.missedActions),
    risk_score: sanitizeRiskScore(data.riskAssessment?.score),
    ai_summary: sanitizeText(data.aiSummary, 20000),
    critical_alerts: buildCriticalAlerts(data),
  };
}
