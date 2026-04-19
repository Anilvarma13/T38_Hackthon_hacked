-- ═══════════════════════════════════════════════════════════════
-- AEGIS-ALPHA CLINICAL INTELLIGENCE SYSTEM — PostgreSQL Schema
-- ═══════════════════════════════════════════════════════════════

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ─── ENUMS ─────────────────────────────────────────────────────
CREATE TYPE user_role       AS ENUM ('admin', 'senior_consultant', 'junior_doctor', 'nurse');
CREATE TYPE task_status     AS ENUM ('pending', 'completed', 'overdue', 'cancelled');
CREATE TYPE risk_level      AS ENUM ('critical', 'high', 'moderate', 'low', 'none');
CREATE TYPE handoff_status  AS ENUM ('pending', 'in_progress', 'completed', 'disputed');
CREATE TYPE gender_type     AS ENUM ('male', 'female', 'other', 'prefer_not_to_say');
CREATE TYPE audit_action    AS ENUM (
  'CREATE', 'READ', 'UPDATE', 'DELETE_SOFT',
  'LOGIN', 'LOGOUT', 'HANDOFF_INITIATED', 'HANDOFF_COMPLETED',
  'RISK_FLAGGED', 'ALERT_SENT', 'MEDICATION_ADMINISTERED'
);

-- ─── CLINICIANS (Users) ─────────────────────────────────────────
CREATE TABLE clinicians (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  staff_id          VARCHAR(20)  UNIQUE NOT NULL,          -- e.g. MED-2026-X7
  full_name         VARCHAR(100) NOT NULL,
  email             VARCHAR(150) UNIQUE NOT NULL,
  password_hash     TEXT         NOT NULL,                 -- bcrypt hashed
  role              user_role    NOT NULL DEFAULT 'junior_doctor',
  department        VARCHAR(80),
  specialization    VARCHAR(80),
  is_active         BOOLEAN      NOT NULL DEFAULT TRUE,
  last_login_at     TIMESTAMPTZ,
  created_at        TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- ─── PATIENTS ───────────────────────────────────────────────────
CREATE TABLE patients (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  mrn               VARCHAR(20)  UNIQUE NOT NULL,          -- Medical Record Number
  full_name         VARCHAR(100) NOT NULL,
  date_of_birth     DATE         NOT NULL,
  gender            gender_type  NOT NULL,
  bed_id            VARCHAR(20),
  ward              VARCHAR(50),
  admission_date    TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  primary_diagnosis TEXT,
  allergies         TEXT[],                               -- Array of allergy strings
  is_active         BOOLEAN      NOT NULL DEFAULT TRUE,
  is_deleted        BOOLEAN      NOT NULL DEFAULT FALSE,  -- Soft delete
  deleted_at        TIMESTAMPTZ,
  deleted_by        UUID REFERENCES clinicians(id),
  created_at        TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- ─── VITALS HISTORY (Time-series) ───────────────────────────────
CREATE TABLE vitals (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  patient_id        UUID         NOT NULL REFERENCES patients(id) ON DELETE RESTRICT,
  recorded_by       UUID         NOT NULL REFERENCES clinicians(id),

  -- Clinical Values
  bp_systolic       SMALLINT,                             -- mmHg
  bp_diastolic      SMALLINT,                             -- mmHg
  heart_rate        SMALLINT,                             -- bpm
  temperature_f     NUMERIC(5,2),                        -- Fahrenheit
  spo2              SMALLINT,                             -- % oxygen saturation
  respiratory_rate  SMALLINT,                             -- breaths/min
  gcs_score         SMALLINT CHECK (gcs_score BETWEEN 3 AND 15),  -- Glasgow Coma Scale
  pain_score        SMALLINT CHECK (pain_score BETWEEN 0 AND 10),

  -- AI Risk Assessment (computed server-side)
  computed_risk_level risk_level  NOT NULL DEFAULT 'none',
  risk_flags        JSONB        NOT NULL DEFAULT '[]',   -- Array of risk flag objects
  stability_score   SMALLINT     CHECK (stability_score BETWEEN 0 AND 100),

  -- Trend
  vital_trend       VARCHAR(10)  CHECK (vital_trend IN ('rising', 'falling', 'stable')),
  clinical_notes    TEXT,
  created_at        TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- Index for trend queries (most recent vitals per patient)
CREATE INDEX idx_vitals_patient_time ON vitals (patient_id, created_at DESC);

-- ─── PRESCRIBED MEDICATIONS ─────────────────────────────────────
CREATE TABLE prescribed_medications (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  patient_id        UUID         NOT NULL REFERENCES patients(id),
  prescribed_by     UUID         NOT NULL REFERENCES clinicians(id),
  drug_name         VARCHAR(150) NOT NULL,
  dosage            VARCHAR(50)  NOT NULL,
  route             VARCHAR(30)  NOT NULL,               -- IV, oral, IM, etc.
  frequency         VARCHAR(50)  NOT NULL,               -- e.g. "every 8 hours"
  start_date        TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  end_date          TIMESTAMPTZ,
  is_active         BOOLEAN      NOT NULL DEFAULT TRUE,
  created_at        TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- ─── ADMINISTERED MEDICATIONS (Reconciliation) ──────────────────
CREATE TABLE administered_medications (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  prescribed_med_id UUID REFERENCES prescribed_medications(id),
  patient_id        UUID         NOT NULL REFERENCES patients(id),
  administered_by   UUID         NOT NULL REFERENCES clinicians(id),
  drug_name         VARCHAR(150) NOT NULL,
  dosage_given      VARCHAR(50)  NOT NULL,
  status            task_status  NOT NULL DEFAULT 'completed',
  discrepancy_flag  BOOLEAN      NOT NULL DEFAULT FALSE,
  discrepancy_note  TEXT,
  administered_at   TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  created_at        TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- ─── TASKS ──────────────────────────────────────────────────────
CREATE TABLE tasks (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  patient_id        UUID         NOT NULL REFERENCES patients(id),
  assigned_to       UUID         REFERENCES clinicians(id),
  created_by        UUID         NOT NULL REFERENCES clinicians(id),
  title             VARCHAR(200) NOT NULL,
  description       TEXT,
  status            task_status  NOT NULL DEFAULT 'pending',
  priority          VARCHAR(10)  NOT NULL DEFAULT 'normal' CHECK (priority IN ('urgent', 'high', 'normal', 'low')),
  due_at            TIMESTAMPTZ,
  completed_at      TIMESTAMPTZ,
  completed_by      UUID         REFERENCES clinicians(id),
  created_at        TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- ─── SHIFT HANDOFF RECORDS ──────────────────────────────────────
CREATE TABLE handoffs (
  id                    UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  patient_id            UUID         NOT NULL REFERENCES patients(id),
  outgoing_doctor_id    UUID         NOT NULL REFERENCES clinicians(id),
  incoming_doctor_id    UUID         REFERENCES clinicians(id),
  vitals_snapshot_id    UUID         REFERENCES vitals(id),   -- Vitals at time of handoff

  status                handoff_status NOT NULL DEFAULT 'pending',

  -- SBAR Summary (immutable snapshot)
  sbar_situation        TEXT,
  sbar_background       TEXT,
  sbar_assessment       JSONB        DEFAULT '[]',            -- Array of risk objects
  sbar_recommendation   TEXT,

  -- Risk at handoff time
  risk_score_at_handoff SMALLINT,
  risk_level_at_handoff risk_level,
  active_flags          JSONB        DEFAULT '[]',

  -- Legal verification
  verification_status   BOOLEAN      NOT NULL DEFAULT FALSE,
  digital_signature_hash TEXT,                               -- SHA-256 hash
  verified_at           TIMESTAMPTZ,
  audit_trail_id        VARCHAR(30)  UNIQUE,                 -- e.g. ACHI-XXXXX1234

  -- Timestamps
  initiated_at          TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  completed_at          TIMESTAMPTZ,
  created_at            TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- ─── AUDIT LOGS (Immutable — no UPDATE/DELETE ever) ─────────────
CREATE TABLE audit_logs (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  actor_id          UUID         REFERENCES clinicians(id),   -- Who did it
  patient_id        UUID         REFERENCES patients(id),
  action            audit_action NOT NULL,
  resource_type     VARCHAR(50)  NOT NULL,                   -- e.g. 'vitals', 'handoff'
  resource_id       UUID,
  previous_state    JSONB,                                   -- Before state
  new_state         JSONB,                                   -- After state
  ip_address        INET,
  user_agent        TEXT,
  metadata          JSONB        DEFAULT '{}',
  created_at        TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- Audit logs MUST NOT be updated or deleted (legal compliance)
CREATE RULE no_update_audit AS ON UPDATE TO audit_logs DO INSTEAD NOTHING;
CREATE RULE no_delete_audit AS ON DELETE TO audit_logs DO INSTEAD NOTHING;

-- Index for fast audit queries
CREATE INDEX idx_audit_actor    ON audit_logs (actor_id, created_at DESC);
CREATE INDEX idx_audit_patient  ON audit_logs (patient_id, created_at DESC);
CREATE INDEX idx_audit_action   ON audit_logs (action, created_at DESC);

-- ─── REAL-TIME ALERTS ───────────────────────────────────────────
CREATE TABLE clinical_alerts (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  patient_id        UUID         NOT NULL REFERENCES patients(id),
  generated_by      VARCHAR(20)  NOT NULL DEFAULT 'RISK_ENGINE',
  alert_type        VARCHAR(50)  NOT NULL,                  -- 'SEPSIS_RISK', 'STALE_VITALS' etc.
  severity          risk_level   NOT NULL,
  title             VARCHAR(200) NOT NULL,
  message           TEXT         NOT NULL,
  data_trigger      JSONB        NOT NULL DEFAULT '{}',     -- Which data point triggered it
  is_acknowledged   BOOLEAN      NOT NULL DEFAULT FALSE,
  acknowledged_by   UUID         REFERENCES clinicians(id),
  acknowledged_at   TIMESTAMPTZ,
  expires_at        TIMESTAMPTZ,
  created_at        TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_alerts_patient ON clinical_alerts (patient_id, is_acknowledged, created_at DESC);

-- ─── REFRESH TOKENS ─────────────────────────────────────────────
CREATE TABLE refresh_tokens (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  clinician_id      UUID         NOT NULL REFERENCES clinicians(id) ON DELETE CASCADE,
  token_hash        TEXT         NOT NULL UNIQUE,            -- hashed token storage
  expires_at        TIMESTAMPTZ  NOT NULL,
  revoked           BOOLEAN      NOT NULL DEFAULT FALSE,
  revoked_at        TIMESTAMPTZ,
  created_at        TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- ─── TRIGGERS — auto-update updated_at ──────────────────────────
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_clinicians_updated BEFORE UPDATE ON clinicians
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_patients_updated BEFORE UPDATE ON patients
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_handoffs_updated BEFORE UPDATE ON handoffs
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_tasks_updated BEFORE UPDATE ON tasks
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
