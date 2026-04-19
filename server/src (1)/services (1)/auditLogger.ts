/* ═══════════════════════════════════════════════════════════════
   Immutable Audit Logger
═══════════════════════════════════════════════════════════════ */
import { v4 as uuidv4 } from 'uuid';
import { pool }          from '../config/database';

interface AuditPayload {
  actorId:       string;
  patientId?:    string;
  action:        string;
  resourceType:  string;
  resourceId?:   string;
  previousState?: object;
  newState?:      object;
  ipAddress?:    string;
  userAgent?:    string;
  metadata?:     object;
}

export async function logAudit(payload: AuditPayload): Promise<void> {
  try {
    await pool.query(
      `INSERT INTO audit_logs
       (id, actor_id, patient_id, action, resource_type, resource_id,
        previous_state, new_state, ip_address, user_agent, metadata)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
      [
        uuidv4(),
        payload.actorId,
        payload.patientId  ?? null,
        payload.action,
        payload.resourceType,
        payload.resourceId ?? null,
        payload.previousState ? JSON.stringify(payload.previousState) : null,
        payload.newState      ? JSON.stringify(payload.newState)      : null,
        payload.ipAddress  ?? null,
        payload.userAgent  ?? null,
        JSON.stringify(payload.metadata ?? {}),
      ]
    );
  } catch (err) {
    // Audit failures must NEVER crash the main request
    console.error('[AUDIT LOG FAILURE]', err);
  }
}
