import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Shield, CheckCircle, AlertTriangle, Clock,
  User, Printer, ChevronLeft, Activity
} from 'lucide-react';
import { AppContext } from '../App';
import { analyzeRisks }    from '../data/riskEngine';
import './HandoffPage.css';

/* ── Checklist items ──────────────────────────────────────── */
const CHECKLIST = [
  { id: 'allergies', label: 'Allergy information reviewed or obtained from patient/family' },
  { id: 'meds',      label: 'All medications reconciled — missed doses escalated'           },
  { id: 'vitals',    label: 'Current vitals reviewed and within acceptable range'           },
  { id: 'labs',      label: 'All critical laboratory results acknowledged'                  },
  { id: 'plan',      label: 'Care plan clearly communicated to incoming team'               },
  { id: 'escalation',label: 'Escalation criteria and thresholds understood'                },
];

export default function HandoffPage() {
  const navigate = useNavigate();
  const { patientData } = React.useContext(AppContext);

  const patient = patientData || require('../data/mockPatientData').mockPatientData;
  const analysis = useMemo(() => analyzeRisks(patient), [patient]);

  const [checked, setChecked]   = useState({});
  const [ackState, setAckState] = useState('idle'); // idle | form | done
  const [drName, setDrName]     = useState('');
  const [timestamp, setTs]      = useState(null);

  const criticals = analysis.alerts.filter(a => a.level === 'critical');
  const allChecked = CHECKLIST.every(i => checked[i.id]);

  const toggle = id => setChecked(p => ({ ...p, [id]: !p[id] }));

  const confirm = () => {
    if (!drName.trim()) return;
    setTs(new Date());
    setAckState('done');
  };

  const checkedCount = Object.values(checked).filter(Boolean).length;

  return (
    <main className="handoff-page page">

      {/* ── Critical Alerts Banner ──────────────────────────── */}
      {criticals.length > 0 && (
        <div className="critical-banner animate-scaleIn">
          <div className="cb-title">
            <AlertTriangle size={17} strokeWidth={2.5} />
            {criticals.length} Critical Alert{criticals.length > 1 ? 's' : ''} — Immediate Action Required
          </div>
          <div className="cb-items">
            {criticals.map(a => (
              <div key={a.id} className="cb-item">
                <span className="cb-bullet">🔴</span>
                <div>
                  <strong>{a.title}</strong>
                  <span className="cb-detail"> — {a.detail}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="page-header animate-fadeUp">
        <h1 className="page-title">Doctor Handoff View</h1>
        <p className="page-subtitle">
          Incoming clinician safety briefing &nbsp;·&nbsp;
          {new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
        </p>
      </div>

      <div className="hf-grid">

        {/* ── LEFT COLUMN ───────────────────────────────────── */}
        <div className="hf-left">

          {/* Patient Quick Card */}
          <div className="card hf-patient-card animate-fadeUp">
            <div className="section-label">Incoming Patient</div>
            <div className="hfp-name">{patient.name}</div>
            <div className="hfp-meta">
              {patient.age} yr · {patient.gender} · {patient.ward}
            </div>
            <div className="hfp-badges">
              <span className="badge badge-critical">{patient.caseType}</span>
              <span className="badge badge-info">{patient.id}</span>
            </div>

            <div className="hfp-divider" />

            {/* Key vitals */}
            <div className="hfp-vitals">
              {[
                { emoji: '❤️', lbl: 'HR',   val: `${patient.vitals.heartRate} bpm`,                                              warn: patient.vitals.heartRate > 100 },
                { emoji: '🩺', lbl: 'BP',   val: `${patient.vitals.bloodPressureSystolic}/${patient.vitals.bloodPressureDiastolic}`, warn: patient.vitals.bloodPressureSystolic >= 140 },
                { emoji: '🌡️', lbl: 'Temp', val: `${patient.vitals.temperature}°C`,                                              warn: patient.vitals.temperature >= 37.5 },
                { emoji: '💨', lbl: 'SpO₂', val: `${patient.vitals.spo2}%`,                                                      warn: patient.vitals.spo2 < 95 },
              ].map(({ emoji, lbl, val, warn }) => (
                <div key={lbl} className={`hfpv-item ${warn ? 'hfpv-warn' : 'hfpv-ok'}`}>
                  <span className="hfpv-emoji">{emoji}</span>
                  <span className="hfpv-lbl">{lbl}</span>
                  <span className="hfpv-val mono">{val}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Risk Score */}
          <div className={`card hf-risk-card risk-card-${analysis.riskLevel.toLowerCase()} animate-fadeUp stagger-1`}>
            <div className="hfr-score mono">{analysis.riskScore}</div>
            <div className="hfr-label">/ 100 Risk Score</div>
            <span className={`badge badge-${analysis.riskLevel === 'HIGH' ? 'critical' : analysis.riskLevel === 'MEDIUM' ? 'warning' : 'safe'}`} style={{ marginTop: 8 }}>
              <Shield size={11} /> {analysis.riskLevel} RISK
            </span>
          </div>

          {/* Next Appointment */}
          <div className="card hf-appt-card animate-fadeUp stagger-2">
            <div className="section-label">Next Appointment</div>
            <div className="hfa-date">
              <Clock size={13} style={{ color: 'var(--info)' }} />
              {patient.nextAppointment.date} &nbsp;·&nbsp; {patient.nextAppointment.time}
            </div>
            <div className="hfa-dept">{patient.nextAppointment.department}</div>
            <div className="hfa-doc">{patient.nextAppointment.doctor}</div>
          </div>
        </div>

        {/* ── RIGHT COLUMN ──────────────────────────────────── */}
        <div className="hf-right">

          {/* Clinical Summary */}
          <div className="card hf-summary-card animate-fadeUp">
            <div className="section-label">Clinical Summary</div>
            <p className="hf-summary-text">{patient.clinicalNotes}</p>
          </div>

          {/* Immediate Actions */}
          <div className="card hf-actions-card animate-fadeUp stagger-1">
            <div className="section-label">
              <AlertTriangle size={12} style={{ color: 'var(--critical)' }} />
              Immediate Actions Required
            </div>
            <ol className="hf-action-list">
              {analysis.recommendations.slice(0, 4).map((rec, i) => (
                <li key={i} className={`hf-action ${i < 2 ? 'hfa-urgent' : 'hfa-std'}`}>
                  <span className={`hfa-num ${i < 2 ? 'hfan-urgent' : 'hfan-std'}`}>{i + 1}</span>
                  <span>{rec}</span>
                </li>
              ))}
            </ol>
          </div>

          {/* Safety Checklist */}
          <div className="card hf-checklist-card animate-fadeUp stagger-2">
            <div className="section-label">
              <CheckCircle size={12} style={{ color: 'var(--safe)' }} />
              Handoff Safety Checklist
            </div>

            <div className="hfc-list">
              {CHECKLIST.map(item => (
                <label key={item.id} className={`hfc-item ${checked[item.id] ? 'hfci-checked' : ''}`}>
                  <input
                    type="checkbox"
                    id={`chk-${item.id}`}
                    checked={!!checked[item.id]}
                    onChange={() => toggle(item.id)}
                    hidden
                  />
                  <div className="hfci-box">
                    {checked[item.id] && <CheckCircle size={13} strokeWidth={2.8} />}
                  </div>
                  <span className="hfci-label">{item.label}</span>
                </label>
              ))}
            </div>

            {/* Progress */}
            <div className="hfc-progress">
              <div className="hfcp-bar">
                <div
                  className="hfcp-fill"
                  style={{ width: `${(checkedCount / CHECKLIST.length) * 100}%` }}
                />
              </div>
              <span className="hfcp-txt mono">{checkedCount}/{CHECKLIST.length}</span>
            </div>
          </div>

          {/* Acknowledge – Idle */}
          {ackState === 'idle' && (
            <div className="card hf-ack-card animate-fadeUp stagger-3">
              {!allChecked && (
                <div className="ack-warning">
                  ⚠️ Complete all checklist items before acknowledging the handoff.
                </div>
              )}
              <button
                id="acknowledge-btn"
                className="btn btn-success btn-lg"
                disabled={!allChecked}
                onClick={() => setAckState('form')}
                style={{ width: '100%', justifyContent: 'center' }}
              >
                <Shield size={17} />
                Acknowledge Patient Handoff
              </button>
            </div>
          )}

          {/* Acknowledge – Form */}
          {ackState === 'form' && (
            <div className="card hf-ack-form animate-scaleIn">
              <div className="section-label">
                <User size={12} style={{ color: 'var(--info)' }} />
                Incoming Doctor Confirmation
              </div>
              <div className="hfaf-body">
                <input
                  id="doctor-name-input"
                  type="text"
                  className="hfaf-input"
                  placeholder="Doctor Name"
                  value={drName}
                  onChange={e => setDrName(e.target.value)}
                  autoFocus
                />
                <div className="hfaf-ts">
                  <Clock size={12} />
                  {new Date().toLocaleString('en-IN')}
                </div>
                <button
                  id="confirm-ack-btn"
                  className="btn btn-success"
                  disabled={!drName.trim()}
                  onClick={confirm}
                  style={{ width: '100%', justifyContent: 'center' }}
                >
                  <CheckCircle size={15} />
                  Confirm & Sign Off
                </button>
              </div>
            </div>
          )}

          {/* Acknowledge – Done */}
          {ackState === 'done' && (
            <div className="card hf-ack-done animate-scaleIn">
              <div className="hfad-content">
                <div className="hfad-icon"><CheckCircle size={40} strokeWidth={1.8} /></div>
                <div className="hfad-title">Handoff Acknowledged</div>
                <div className="hfad-doc">Dr. {drName}</div>
                <div className="hfad-ts">
                  <Clock size={12} />
                  {timestamp?.toLocaleString('en-IN')}
                </div>
                <p className="hfad-note">
                  This acknowledgment is recorded. The incoming clinician has accepted full responsibility for patient care.
                </p>
              </div>
            </div>
          )}

        </div>
      </div>

      {/* ── Footer ──────────────────────────────────────────── */}
      <div className="hf-footer no-print animate-fadeUp">
        <button className="btn btn-outline" onClick={() => navigate('/summary')}>
          <ChevronLeft size={15} /> Back to Insights
        </button>
        <button id="print-handoff-btn" className="btn btn-outline" onClick={() => window.print()}>
          <Printer size={15} /> Print Handoff Report
        </button>
        <button className="btn btn-ghost" onClick={() => navigate('/')}>
          <Activity size={15} /> New Patient Upload
        </button>
      </div>

    </main>
  );
}
