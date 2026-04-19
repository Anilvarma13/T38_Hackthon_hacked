/* ═══════════════════════════════════════════════════════════════
   Vitals Routes — POST / GET with Risk Middleware
   POST /api/v1/vitals/:patientId
   GET  /api/v1/vitals/:patientId
   GET  /api/v1/vitals/:patientId/trends
═══════════════════════════════════════════════════════════════ */
import { Router, Request, Response } from 'express';
import { body, validationResult }    from 'express-validator';
import { v4 as uuidv4 }             from 'uuid';
import { pool }                     from '../config/database';
import { authenticate, requireRole } from '../middleware/auth';
import { evaluateRisk, calculateTrend, isVitalsStale, VitalsInput } from '../services/riskEngine';
import { logAudit }                 from '../services/auditLogger';
import { emitCriticalAlert }        from '../socket/alerts';

const router = Router();

/* ── Validation schema ─────────────────────────────── */
const vitalsValidation = [
  body('bpSystolic').optional().isInt({ min: 40, max: 300 }),
  body('bpDiastolic').optional().isInt({ min: 20, max: 200 }),
  body('heartRate').optional().isInt({ min: 10, max: 300 }),
  body('temperatureF').optional().isFloat({ min: 85, max: 115 }),
  body('spo2').optional().isInt({ min: 50, max: 100 }),
  body('respiratoryRate').optional().isInt({ min: 0, max: 80 }),
  body('gcsScore').optional().isInt({ min: 3, max: 15 }),
  body('painScore').optional().isInt({ min: 0, max: 10 }),
  body('clinicalNotes').optional().isString().trim().isLength({ max: 5000 }),
  body('vitalTrend').optional().isIn(['rising', 'falling', 'stable']),
];

/* ── POST /vitals/:patientId — Record new vitals ───── */
router.post(
  '/:patientId',
  authenticate,
  vitalsValidation,
  async (req: Request, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty())
      return res.status(422).json({ error: 'Validation failed', details: errors.array() });

    const { patientId } = req.params;
    const clinicianId   = req.user!.sub;

    const vitalsInput: VitalsInput = {
      bpSystolic:      req.body.bpSystolic      ?? null,
      bpDiastolic:     req.body.bpDiastolic     ?? null,
      heartRate:       req.body.heartRate       ?? null,
      temperatureF:    req.body.temperatureF    ?? null,
      spo2:            req.body.spo2            ?? null,
      respiratoryRate: req.body.respiratoryRate ?? null,
      gcsScore:        req.body.gcsScore        ?? null,
      clinicalNotes:   req.body.clinicalNotes   ?? '',
    };

    /* ── Server-side Risk Engine ── */
    const riskResult = evaluateRisk(vitalsInput);

    /* ── Insert vitals ── */
    const { rows } = await pool.query(
      `INSERT INTO vitals
       (id, patient_id, recorded_by, bp_systolic, bp_diastolic, heart_rate, temperature_f,
        spo2, respiratory_rate, gcs_score, pain_score, clinical_notes, vital_trend,
        computed_risk_level, risk_flags, stability_score)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)
       RETURNING *`,
      [
        uuidv4(), patientId, clinicianId,
        vitalsInput.bpSystolic, vitalsInput.bpDiastolic, vitalsInput.heartRate,
        vitalsInput.temperatureF, vitalsInput.spo2, vitalsInput.respiratoryRate,
        vitalsInput.gcsScore, req.body.painScore ?? null,
        vitalsInput.clinicalNotes, req.body.vitalTrend ?? 'stable',
        riskResult.overallLevel, JSON.stringify(riskResult.flags),
        riskResult.stabilityScore,
      ]
    );
    const newVitals = rows[0];

    /* ── If critical — emit real-time WebSocket alert ── */
    if (riskResult.overallLevel === 'critical' || riskResult.sepsisRisk) {
      const criticalFlags = riskResult.flags
        .filter(f => f.level === 'critical')
        .map(f => f.title)
        .join(', ');

      // Save alert to DB
      await pool.query(
        `INSERT INTO clinical_alerts
         (id, patient_id, alert_type, severity, title, message, data_trigger)
         VALUES ($1,$2,$3,$4,$5,$6,$7)`,
        [
          uuidv4(), patientId,
          riskResult.sepsisRisk ? 'SEPSIS_RISK' : 'CRITICAL_VITALS',
          riskResult.overallLevel,
          riskResult.sepsisRisk ? '🚨 SEPSIS RISK DETECTED' : '🚨 Critical Vitals Alert',
          `Patient requires IMMEDIATE attention. Flags: ${criticalFlags}`,
          JSON.stringify({ vitalsId: newVitals.id, flags: riskResult.flags.map(f => f.code) }),
        ]
      );

      // Push via WebSocket to all connected dashboard clients
      emitCriticalAlert(patientId, {
        patientId,
        vitalsId:    newVitals.id,
        riskLevel:   riskResult.overallLevel,
        flags:       riskResult.flags,
        sepsisRisk:  riskResult.sepsisRisk,
        timestamp:   new Date().toISOString(),
      });
    }

    /* ── Audit Log ── */
    await logAudit({
      actorId:      clinicianId,
      patientId,
      action:       'CREATE',
      resourceType: 'vitals',
      resourceId:   newVitals.id,
      newState:     { ...vitalsInput, riskLevel: riskResult.overallLevel },
      ipAddress:    req.ip,
      userAgent:    req.headers['user-agent'],
    });

    return res.status(201).json({
      vitals:     newVitals,
      riskResult,
      message:    'Vitals recorded successfully',
    });
  }
);

/* ── GET /vitals/:patientId — Recent vitals history ─── */
router.get('/:patientId', authenticate, async (req: Request, res: Response) => {
  const { patientId } = req.params;
  const limit  = Math.min(Number(req.query.limit)  || 20, 100);
  const offset = Number(req.query.offset) || 0;

  const { rows } = await pool.query(
    `SELECT v.*, c.full_name AS recorded_by_name, c.staff_id
     FROM vitals v
     JOIN clinicians c ON v.recorded_by = c.id
     WHERE v.patient_id = $1
     ORDER BY v.created_at DESC
     LIMIT $2 OFFSET $3`,
    [patientId, limit, offset]
  );

  /* ── Stale vitals check ── */
  const staleWarning = rows.length > 0 && isVitalsStale(rows[0].created_at, 4)
    ? { code: 400, message: `⚠ Vitals not updated in over 4 hours. Last: ${rows[0].created_at}` }
    : null;

  return res.json({ vitals: rows, staleWarning, total: rows.length });
});

/* ── GET /vitals/:patientId/trends — Delta analysis ─── */
router.get('/:patientId/trends', authenticate, async (req: Request, res: Response) => {
  const { patientId } = req.params;

  // Fetch snapshots at 4h, 8h, 24h intervals
  const now   = new Date();
  const h4    = new Date(now.getTime() - 4  * 3600_000);
  const h8    = new Date(now.getTime() - 8  * 3600_000);
  const h24   = new Date(now.getTime() - 24 * 3600_000);

  const current = await pool.query(
    `SELECT bp_systolic, heart_rate, temperature_f, spo2, created_at
     FROM vitals WHERE patient_id = $1 ORDER BY created_at DESC LIMIT 1`,
    [patientId]
  );

  const fetchAt = async (since: Date) => pool.query(
    `SELECT bp_systolic, heart_rate, temperature_f, spo2, created_at
     FROM vitals WHERE patient_id = $1 AND created_at <= $2
     ORDER BY created_at DESC LIMIT 1`,
    [patientId, since]
  );

  const [at4h, at8h, at24h] = await Promise.all([fetchAt(h4), fetchAt(h8), fetchAt(h24)]);

  const toSnap = (row: any) => ({
    bpSystolic:   row?.bp_systolic   ?? null,
    heartRate:    row?.heart_rate    ?? null,
    temperatureF: row?.temperature_f ?? null,
    spo2:         row?.spo2          ?? null,
    createdAt:    row?.created_at    ?? now,
  });

  const curr = toSnap(current.rows[0]);

  return res.json({
    current: curr,
    trends: {
      last4h:  at4h.rows[0]  ? calculateTrend(curr, toSnap(at4h.rows[0]))  : null,
      last8h:  at8h.rows[0]  ? calculateTrend(curr, toSnap(at8h.rows[0]))  : null,
      last24h: at24h.rows[0] ? calculateTrend(curr, toSnap(at24h.rows[0])) : null,
    }
  });
});

export default router;
