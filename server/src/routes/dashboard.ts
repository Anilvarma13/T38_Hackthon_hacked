/* ═══════════════════════════════════════════════════════════════
   Dashboard Routes — Acuity Triage + Shift Delta
   GET /api/v1/dashboard/triage
   GET /api/v1/dashboard/shift-delta
   GET /api/v1/dashboard/alerts
═══════════════════════════════════════════════════════════════ */
import { Router, Request, Response } from 'express';
import { pool }                      from '../config/database';
import { authenticate }              from '../middleware/auth';

const router = Router();

/* ── GET /triage — Patients sorted by risk score ─────── */
router.get('/triage', authenticate, async (_req: Request, res: Response) => {
  const { rows } = await pool.query(
    `SELECT
       p.id, p.mrn, p.full_name, p.bed_id, p.ward,
       p.primary_diagnosis,
       v.id            AS latest_vitals_id,
       v.bp_systolic, v.bp_diastolic, v.heart_rate,
       v.temperature_f, v.spo2,
       v.computed_risk_level,
       v.stability_score,
       v.risk_flags,
       v.created_at    AS vitals_recorded_at,
       c.full_name     AS recorded_by_name,
       EXTRACT(EPOCH FROM (NOW() - v.created_at)) / 3600 AS hours_since_vitals
     FROM patients p
     LEFT JOIN LATERAL (
       SELECT * FROM vitals
       WHERE patient_id = p.id
       ORDER BY created_at DESC
       LIMIT 1
     ) v ON TRUE
     LEFT JOIN clinicians c ON v.recorded_by = c.id
     WHERE p.is_deleted = FALSE AND p.is_active = TRUE
     ORDER BY
       CASE v.computed_risk_level
         WHEN 'critical' THEN 1
         WHEN 'high'     THEN 2
         WHEN 'moderate' THEN 3
         WHEN 'low'      THEN 4
         ELSE                 5
       END ASC,
       v.stability_score ASC NULLS LAST`
  );

  const triage = rows.map((row: any) => ({
    patient: {
      id:               row.id,
      mrn:              row.mrn,
      name:             row.full_name,
      bedId:            row.bed_id,
      ward:             row.ward,
      primaryDiagnosis: row.primary_diagnosis,
    },
    vitals: {
      bpSystolic:       row.bp_systolic,
      bpDiastolic:      row.bp_diastolic,
      heartRate:        row.heart_rate,
      temperatureF:     row.temperature_f,
      spo2:             row.spo2,
      recordedAt:       row.vitals_recorded_at,
      recordedBy:       row.recorded_by_name,
      hoursSinceUpdate: row.hours_since_vitals ? Number(row.hours_since_vitals).toFixed(1) : null,
      isStale:          row.hours_since_vitals > 4,
    },
    risk: {
      level:          row.computed_risk_level ?? 'none',
      stabilityScore: row.stability_score,
      flags:          row.risk_flags ?? [],
    },
  }));

  return res.json({ patients: triage, count: triage.length, generatedAt: new Date() });
});

/* ── GET /shift-delta — Changes in last 12 hours ────────── */
router.get('/shift-delta', authenticate, async (_req: Request, res: Response) => {
  const since12h = new Date(Date.now() - 12 * 3600_000);

  const { rows } = await pool.query(
    `SELECT
       v.patient_id,
       p.full_name AS patient_name,
       p.bed_id, p.ward,
       MAX(v.computed_risk_level) AS peak_risk,
       MIN(v.stability_score)     AS min_stability,
       MAX(v.stability_score)     AS max_stability,
       COUNT(*)                   AS vitals_count,
       MAX(v.created_at)          AS last_reading,
       ARRAY_AGG(DISTINCT al.alert_type) FILTER (WHERE al.alert_type IS NOT NULL) AS alert_types
     FROM vitals v
     JOIN patients p ON p.id = v.patient_id
     LEFT JOIN clinical_alerts al
       ON al.patient_id = v.patient_id
       AND al.created_at > $1
     WHERE v.created_at > $1 AND p.is_deleted = FALSE
     GROUP BY v.patient_id, p.full_name, p.bed_id, p.ward
     ORDER BY peak_risk ASC, min_stability ASC`,
    [since12h]
  );

  const newHandoffs = await pool.query(
    `SELECT h.*, p.full_name AS patient_name,
            oc.full_name AS outgoing_doctor, ic.full_name AS incoming_doctor
     FROM handoffs h
     JOIN patients p ON p.id = h.patient_id
     JOIN clinicians oc ON oc.id = h.outgoing_doctor_id
     LEFT JOIN clinicians ic ON ic.id = h.incoming_doctor_id
     WHERE h.initiated_at > $1`,
    [since12h]
  );

  const newTasks = await pool.query(
    `SELECT t.*, p.full_name AS patient_name
     FROM tasks t
     JOIN patients p ON p.id = t.patient_id
     WHERE t.created_at > $1 OR t.updated_at > $1`,
    [since12h]
  );

  return res.json({
    shiftWindow: { from: since12h, to: new Date() },
    vitalsActivity: rows,
    handoffs:       newHandoffs.rows,
    tasks:          newTasks.rows,
    summary: {
      patientsMonitored: rows.length,
      handoffsCompleted: newHandoffs.rows.filter((h: any) => h.status === 'completed').length,
      criticalAlerts:    rows.filter((r: any) => r.peak_risk === 'critical').length,
    },
  });
});

/* ── GET /alerts — Active unacknowledged alerts ─────── */
router.get('/alerts', authenticate, async (_req: Request, res: Response) => {
  const { rows } = await pool.query(
    `SELECT a.*, p.full_name AS patient_name, p.bed_id
     FROM clinical_alerts a
     JOIN patients p ON p.id = a.patient_id
     WHERE a.is_acknowledged = FALSE
       AND (a.expires_at IS NULL OR a.expires_at > NOW())
     ORDER BY
       CASE a.severity WHEN 'critical' THEN 1 WHEN 'high' THEN 2
         WHEN 'moderate' THEN 3 ELSE 4 END,
       a.created_at DESC
     LIMIT 50`
  );

  return res.json({ alerts: rows, count: rows.length });
});

export default router;
