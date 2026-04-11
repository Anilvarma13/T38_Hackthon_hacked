// Risk Engine: Processes mock patient data and produces alerts, score, and recommendations

const THRESHOLDS = {
  HR_HIGH: 100,
  HR_LOW: 50,
  BP_SYSTOLIC_HIGH: 140,
  BP_SYSTOLIC_CRITICAL: 160,
  BP_DIASTOLIC_HIGH: 90,
  TEMP_HIGH: 37.5,
  TEMP_CRITICAL: 38.0,
  SPO2_LOW: 95,
  SPO2_CRITICAL: 90,
  RR_HIGH: 20,
  GCS_LOW: 14,
};

export function analyzeRisks(patient) {
  const alerts = [];
  let score = 0;
  const vitals = patient.vitals;

  // ─── CRITICAL VITALS ───────────────────────────────────────────────
  if (vitals.bloodPressureSystolic >= THRESHOLDS.BP_SYSTOLIC_CRITICAL) {
    alerts.push({
      id: "bp-critical",
      level: "critical",
      category: "Vitals",
      title: "Hypertensive Crisis Detected",
      detail: `BP ${vitals.bloodPressureSystolic}/${vitals.bloodPressureDiastolic} mmHg — exceeds critical threshold (>160). Risk of stroke, organ damage.`,
      tooltip: "Systolic BP > 160 mmHg is classified as a hypertensive crisis requiring immediate intervention.",
      recommendation: "Administer IV antihypertensive immediately. Verify current medication compliance.",
      icon: "🔴",
    });
    score += 25;
  } else if (vitals.bloodPressureSystolic >= THRESHOLDS.BP_SYSTOLIC_HIGH) {
    alerts.push({
      id: "bp-warning",
      level: "warning",
      category: "Vitals",
      title: "Elevated Blood Pressure",
      detail: `BP ${vitals.bloodPressureSystolic}/${vitals.bloodPressureDiastolic} mmHg — above normal range.`,
      tooltip: "Systolic BP > 140 indicates Stage 2 hypertension.",
      recommendation: "Monitor BP every 30 minutes. Review antihypertensive regimen.",
      icon: "🟡",
    });
    score += 12;
  }

  if (vitals.heartRate > THRESHOLDS.HR_HIGH) {
    const severity = vitals.heartRate > 120 ? "critical" : "warning";
    alerts.push({
      id: "hr-high",
      level: severity,
      category: "Vitals",
      title: severity === "critical" ? "Tachycardia — Critical" : "Elevated Heart Rate",
      detail: `HR ${vitals.heartRate} bpm — ${severity === "critical" ? "severe tachycardia" : "above normal range"}.`,
      tooltip: "HR > 100 bpm = tachycardia. HR > 120 bpm in a cardiac patient is critical.",
      recommendation: severity === "critical" ? "Urgent cardiology review. 12-lead ECG now." : "Monitor hourly. Consider beta-blocker adjustment.",
      icon: severity === "critical" ? "🔴" : "🟡",
    });
    score += severity === "critical" ? 20 : 10;
  }

  if (vitals.temperature >= THRESHOLDS.TEMP_HIGH) {
    const severity = vitals.temperature >= THRESHOLDS.TEMP_CRITICAL ? "warning" : "info";
    alerts.push({
      id: "temp-high",
      level: severity,
      category: "Vitals",
      title: "Fever Detected",
      detail: `Temperature ${vitals.temperature}°C — suggests active infection or inflammatory response.`,
      tooltip: "Fever in a post-cardiac patient may indicate infection, pericarditis, or drug reaction.",
      recommendation: "Blood cultures if not already drawn. Check WBC trend. Reassess antibiotics.",
      icon: "🟡",
    });
    score += 10;
  }

  if (vitals.spo2 < THRESHOLDS.SPO2_LOW) {
    alerts.push({
      id: "spo2-low",
      level: vitals.spo2 < THRESHOLDS.SPO2_CRITICAL ? "critical" : "warning",
      category: "Vitals",
      title: "Low Oxygen Saturation",
      detail: `SpO₂ ${vitals.spo2}% — below acceptable threshold.`,
      tooltip: "SpO₂ < 95% = hypoxemia. Needs supplemental oxygen or airway assessment.",
      recommendation: "Apply supplemental O₂. Reassess respiratory status. Consider ABG.",
      icon: vitals.spo2 < THRESHOLDS.SPO2_CRITICAL ? "🔴" : "🟡",
    });
    score += vitals.spo2 < THRESHOLDS.SPO2_CRITICAL ? 20 : 8;
  }

  if (vitals.gcs < THRESHOLDS.GCS_LOW) {
    alerts.push({
      id: "gcs-low",
      level: "critical",
      category: "Neuro",
      title: "Reduced Consciousness (Low GCS)",
      detail: `GCS ${vitals.gcs} — patient shows signs of neurological compromise.`,
      tooltip: "GCS < 14 in a hypertensive patient may indicate hypertensive encephalopathy.",
      recommendation: "Urgent neurology consult. CT head if not done. Secure airway.",
      icon: "🔴",
    });
    score += 25;
  }

  // ─── MEDICATION GAPS ────────────────────────────────────────────────
  const missedMeds = patient.medications.filter((m) => m.status === "missed");
  const pendingMeds = patient.medications.filter((m) => m.status === "pending" && m.time === null);

  if (missedMeds.length > 0) {
    alerts.push({
      id: "med-missed",
      level: "critical",
      category: "Medication",
      title: "Missed Medication(s) Detected",
      detail: `${missedMeds.map((m) => m.name).join(", ")} — not administered as scheduled.`,
      tooltip: "Missed cardiac medications can cause rebound hypertension or arrhythmia.",
      recommendation: "Administer missed medications immediately or escalate to pharmacist.",
      icon: "🔴",
    });
    score += 15;
  }

  if (pendingMeds.length > 0) {
    alerts.push({
      id: "med-pending",
      level: "warning",
      category: "Medication",
      title: "Medication Schedule Incomplete",
      detail: `${pendingMeds.map((m) => m.name).join(", ")} — no scheduled time recorded.`,
      tooltip: "Medications without scheduled times risk being skipped during shift change.",
      recommendation: "Assign administration time and confirm at handoff.",
      icon: "🟡",
    });
    score += 8;
  }

  // ─── MISSING INFORMATION ─────────────────────────────────────────────
  if (!patient.allergyInfo) {
    alerts.push({
      id: "allergy-missing",
      level: "missing",
      category: "Missing Info",
      title: "Allergy Information Not Recorded",
      detail: "No allergy data found in the patient record.",
      tooltip: "Missing allergy info is a patient safety red flag before any new medication.",
      recommendation: "Obtain verbal allergy history from patient/family before next medication.",
      icon: "⚠️",
    });
    score += 10;
  }

  if (patient.echoStatus === "pending") {
    alerts.push({
      id: "echo-pending",
      level: "missing",
      category: "Missing Info",
      title: "Echocardiogram Pending",
      detail: "Echo ordered but not yet performed. Cardiac function unknown.",
      tooltip: "Without echo, LV function and wall motion cannot be assessed in a cardiac patient.",
      recommendation: "Prioritize echo within 4 hours. Alert cardiology for urgent slot.",
      icon: "⚠️",
    });
    score += 8;
  }

  // Check time since last vitals update
  const lastUpdate = new Date(patient.lastVitalsUpdate);
  const now = new Date();
  const hoursSinceUpdate = (now - lastUpdate) / (1000 * 60 * 60);
  if (hoursSinceUpdate > 4) {
    alerts.push({
      id: "vitals-stale",
      level: "warning",
      category: "Missing Info",
      title: "Vitals Not Updated Recently",
      detail: `Last recorded vitals were ${Math.floor(hoursSinceUpdate)} hours ago.`,
      tooltip: "Vitals should be updated every 1–2 hours in ICU patients.",
      recommendation: "Perform complete vital signs assessment immediately.",
      icon: "⚠️",
    });
    score += 7;
  }

  // ─── LAB ABNORMALITIES ─────────────────────────────────────────────
  const criticalLabs = patient.labs.filter((l) => l.status === "high" && ["Troponin I", "BNP"].includes(l.name));
  if (criticalLabs.length > 0) {
    alerts.push({
      id: "labs-critical",
      level: "critical",
      category: "Labs",
      title: "Critical Cardiac Biomarkers Elevated",
      detail: criticalLabs.map((l) => `${l.name}: ${l.value} ${l.unit}`).join(" | "),
      tooltip: "Elevated Troponin and BNP suggest myocardial injury and heart failure.",
      recommendation: "Serial Troponin every 3 hours. Cardiology review urgently.",
      icon: "🔴",
    });
    score += 20;
  }

  // ─── TREND-BASED WARNINGS ──────────────────────────────────────────
  const bpTrend = analyzeTrend(patient.bpHistory.map((b) => b.systolic));
  const hrTrend = analyzeTrend(patient.hrHistory.map((h) => h.hr));

  if (bpTrend === "increasing") {
    alerts.push({
      id: "bp-trend",
      level: "warning",
      category: "Trend",
      title: "BP Showing Increasing Trend",
      detail: "Systolic BP has been rising consistently over the last 20 hours.",
      tooltip: "Increasing BP trend despite treatment may indicate medication resistance or worsening condition.",
      recommendation: "Review antihypertensive efficacy. Consider IV labetalol protocol.",
      icon: "🟡",
    });
    score += 10;
  }

  if (hrTrend === "unstable") {
    alerts.push({
      id: "hr-trend",
      level: "warning",
      category: "Trend",
      title: "HR Pattern Unstable",
      detail: "Heart rate has been fluctuating significantly — not stabilizing.",
      tooltip: "Fluctuating HR may suggest arrhythmia, pain, or inadequate rate control.",
      recommendation: "Continuous cardiac monitor. Reassess rate-control medications.",
      icon: "🟡",
    });
    score += 8;
  }

  // ─── SORT & SCORE ──────────────────────────────────────────────────
  const levelOrder = { critical: 0, warning: 1, missing: 2, info: 3 };
  alerts.sort((a, b) => levelOrder[a.level] - levelOrder[b.level]);

  const riskScore = Math.min(score, 100);
  const riskLevel = riskScore >= 70 ? "HIGH" : riskScore >= 40 ? "MEDIUM" : "LOW";

  const recommendations = [
    ...new Set(alerts.map((a) => a.recommendation).filter(Boolean)),
  ].slice(0, 6);

  return { alerts, riskScore, riskLevel, bpTrend, hrTrend, recommendations };
}

function analyzeTrend(values) {
  if (values.length < 3) return "insufficient";
  const diffs = values.slice(1).map((v, i) => v - values[i]);
  const increases = diffs.filter((d) => d > 3).length;
  const decreases = diffs.filter((d) => d < -3).length;
  const total = diffs.length;

  if (increases >= total * 0.6) return "increasing";
  if (decreases >= total * 0.6) return "decreasing";
  if (increases >= 1 && decreases >= 1) return "unstable";
  return "stable";
}
