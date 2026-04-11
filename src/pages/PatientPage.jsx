import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Heart, Activity, Thermometer, Wind, Brain,
  AlertTriangle, Info, ChevronRight, Pill,
  FlaskConical, TrendingUp, ClipboardList, Clock
} from 'lucide-react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip as ReTooltip, ResponsiveContainer, ReferenceLine, Legend
} from 'recharts';
import { AppContext } from '../App';
import { analyzeRisks }    from '../data/riskEngine';
import './PatientPage.css';

/* ── Reusable Tooltip ─────────────────────────────────────── */
function Tip({ text, children }) {
  const [show, setShow] = useState(false);
  return (
    <div className="tooltip-wrapper">
      <div onMouseEnter={() => setShow(true)} onMouseLeave={() => setShow(false)}>
        {children}
      </div>
      {show && <div className="tooltip-content">{text}</div>}
    </div>
  );
}

/* ── Vital Card ───────────────────────────────────────────── */
function VitalCard({ icon: Icon, label, value, unit, status, normal, accentColor, delay = 0 }) {
  const map = {
    critical: { cls: 'vc-critical', tag: 'Critical' },
    warning:  { cls: 'vc-warning',  tag: 'Elevated' },
    low:      { cls: 'vc-warning',  tag: 'Low'      },
    normal:   { cls: 'vc-normal',   tag: 'Normal'   },
  };
  const s = map[status] ?? map.normal;

  return (
    <div
      className={`vital-card card ${s.cls}`}
      style={{ animationDelay: `${delay}s` }}
    >
      <div className="vc-top">
        <div className="vc-icon" style={{ background: accentColor + '18', color: accentColor }}>
          <Icon size={17} strokeWidth={2.2} />
        </div>
        <span className={`badge badge-${status === 'normal' ? 'safe' : status === 'critical' ? 'critical' : 'warning'}`}>
          {s.tag}
        </span>
      </div>
      <div className="vc-value mono" style={{ color: status === 'normal' ? 'var(--text-primary)' : accentColor }}>
        {value}
      </div>
      <div className="vc-unit">{unit}</div>
      <div className="vc-label">{label}</div>
      <div className="vc-normal">Normal: {normal}</div>
    </div>
  );
}

/* ── Alert Item ───────────────────────────────────────────── */
function AlertRow({ alert, index }) {
  const [open, setOpen] = useState(false);
  const lvMap = {
    critical: { cls: 'ar-critical', badgeCls: 'badge-critical' },
    warning:  { cls: 'ar-warning',  badgeCls: 'badge-warning'  },
    missing:  { cls: 'ar-missing',  badgeCls: 'badge-missing'  },
    info:     { cls: 'ar-info',     badgeCls: 'badge-info'     },
  };
  const lv = lvMap[alert.level] ?? lvMap.info;

  return (
    <div
      className={`alert-row ${lv.cls}`}
      style={{ animationDelay: `${index * 0.055}s` }}
    >
      {/* Main row */}
      <div className="ar-main">
        <span className="ar-emoji">{alert.icon}</span>
        <div className="ar-body">
          <div className="ar-meta">
            <span className="ar-cat">{alert.category}</span>
            <span className={`badge ${lv.badgeCls}`}>{alert.level}</span>
          </div>
          <div className="ar-title">{alert.title}</div>
          <div className="ar-detail">{alert.detail}</div>
        </div>
        <button
          className="ar-toggle"
          onClick={() => setOpen(o => !o)}
          aria-expanded={open}
          aria-label="Show explanation"
        >
          <Info size={14} strokeWidth={2} />
        </button>
      </div>

      {/* Expanded explanation */}
      {open && (
        <div className="ar-expand animate-fadeIn">
          <div className="ar-explain-label">Clinical Explanation</div>
          <p className="ar-explain">{alert.tooltip}</p>
          <div className="ar-rec">
            <span className="ar-rec-label">Recommended Action</span>
            <span className="ar-rec-text">{alert.recommendation}</span>
          </div>
        </div>
      )}
    </div>
  );
}

/* ── Trend Badge ──────────────────────────────────────────── */
function TrendBadge({ trend }) {
  const map = {
    increasing:   { label: '↑ Increasing', cls: 'tb-warning' },
    decreasing:   { label: '↓ Decreasing', cls: 'tb-info'    },
    unstable:     { label: '⚡ Unstable',   cls: 'tb-critical'},
    stable:       { label: '✓ Stable',     cls: 'tb-safe'    },
    insufficient: { label: '— N/A',        cls: 'tb-muted'   },
  };
  const c = map[trend] ?? map.insufficient;
  return <span className={`trend-badge ${c.cls}`}>{c.label}</span>;
}

/* ── Recharts custom tooltip ──────────────────────────────── */
function ChartTip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="chart-tip">
      <div className="ct-time">{label}</div>
      {payload.map(p => (
        <div key={p.dataKey} className="ct-row">
          <span style={{ color: p.color }}>{p.name}</span>
          <strong style={{ color: p.color }}>{p.value}</strong>
        </div>
      ))}
    </div>
  );
}

/* ════════════════════════════════════════════════════════════
   PATIENT PAGE
   ════════════════════════════════════════════════════════════ */
export default function PatientPage() {
  const navigate = useNavigate();
  const { patientData } = React.useContext(AppContext);
  const [tab, setTab] = useState('overview');

  // Use patientData or mock for direct visits
  const patient = patientData || require('../data/mockPatientData').mockPatientData;

  const analysis = useMemo(() => analyzeRisks(patient), [patient]);

  const v = patient.vitals;

  const vitalRows = [
    { icon: Heart,       label: 'Heart Rate',    value: v.heartRate,                              unit: 'bpm',  status: v.heartRate > 120 ? 'critical' : v.heartRate > 100 ? 'warning' : 'normal', normal: '60–100',     accentColor: '#D64545' },
    { icon: Activity,    label: 'Blood Pressure', value: `${v.bloodPressureSystolic}/${v.bloodPressureDiastolic}`, unit: 'mmHg', status: v.bloodPressureSystolic >= 160 ? 'critical' : v.bloodPressureSystolic >= 140 ? 'warning' : 'normal', normal: '<120/80',    accentColor: '#E6A23C' },
    { icon: Thermometer, label: 'Temperature',   value: v.temperature,                            unit: '°C',   status: v.temperature >= 38 ? 'warning' : 'normal',  normal: '36.1–37.2',    accentColor: '#E67E3C' },
    { icon: Wind,        label: 'SpO₂',          value: v.spo2,                                   unit: '%',    status: v.spo2 < 90 ? 'critical' : v.spo2 < 95 ? 'warning' : 'normal',           normal: '≥95%',        accentColor: '#5B8DEF' },
    { icon: Activity,    label: 'Resp. Rate',    value: v.respiratoryRate,                        unit: '/min', status: v.respiratoryRate > 20 ? 'warning' : 'normal', normal: '12–20',        accentColor: '#9B7ACC' },
    { icon: Brain,       label: 'GCS',           value: `${v.gcs}/15`,                           unit: '',     status: v.gcs < 14 ? 'critical' : v.gcs === 14 ? 'warning' : 'normal',           normal: '15',          accentColor: '#4CAF7D' },
  ];

  const critical = analysis.alerts.filter(a => a.level === 'critical').length;
  const warning  = analysis.alerts.filter(a => a.level === 'warning').length;
  const missing  = analysis.alerts.filter(a => a.level === 'missing').length;

  const TABS = [
    { id: 'overview', label: 'Overview',              icon: ClipboardList },
    { id: 'risks',    label: `Risks (${analysis.alerts.length})`, icon: AlertTriangle },
    { id: 'trends',   label: 'Trends',                icon: TrendingUp    },
    { id: 'labs',     label: 'Labs & Meds',           icon: FlaskConical  },
  ];

  return (
    <main className="patient-page page">

      {/* ── Patient header card ─────────────────────────────── */}
      <div className="pt-header card animate-fadeUp">
        <div className="pth-left">
          <div className="pt-avatar">
            {patient.name.split(' ').map(w => w[0]).join('')}
          </div>
          <div className="pt-info">
            <h1 className="pt-name">{patient.name}</h1>
            <div className="pt-meta">
              <span>{patient.age} yrs • {patient.gender}</span>
              <span className="dot-sep">·</span>
              <span>{patient.ward}</span>
              <span className="dot-sep">·</span>
              <span className="badge badge-critical">{patient.caseType}</span>
            </div>
            <div className="pt-secondary">
              <Clock size={11} />
              Admitted {patient.admittedDate} &nbsp;·&nbsp; {patient.attendingDoctor} &nbsp;·&nbsp; {patient.id}
            </div>
          </div>
        </div>

        {/* Alert count chips */}
        <div className="pth-chips">
          <div className="alert-chip chip-critical"><span>{critical}</span> 🔴 Critical</div>
          <div className="alert-chip chip-warning"> <span>{warning}</span> 🟡 Warnings</div>
          <div className="alert-chip chip-missing"> <span>{missing}</span> ⚠️ Missing</div>
        </div>

        <button
          id="go-summary-btn"
          className="btn btn-primary no-print"
          onClick={() => navigate('/summary')}
        >
          Smart Insights <ChevronRight size={15} />
        </button>
      </div>

      {/* ── Tabs ────────────────────────────────────────────── */}
      <div className="tabs animate-fadeUp stagger-1">
        {TABS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            id={`tab-${id}`}
            className={`tab-btn ${tab === id ? 'active' : ''}`}
            onClick={() => setTab(id)}
          >
            <Icon size={13} strokeWidth={2} />
            {label}
          </button>
        ))}
      </div>

      {/* ══════════════════════════════════════════════════════
          TAB: OVERVIEW
         ══════════════════════════════════════════════════════ */}
      {tab === 'overview' && (
        <div className="tab-panel animate-fadeIn">

          <div className="section-label">Vital Signs</div>
          <div className="vitals-grid">
            {vitalRows.map((v, i) => (
              <VitalCard key={v.label} {...v} delay={i * 0.06} />
            ))}
          </div>

          <div className="divider" />

          <div className="section-label">Clinical Notes</div>
          <div className="clinical-notes card">
            <p>{patient.clinicalNotes}</p>
          </div>

          <div className="section-label" style={{ marginTop: 20 }}>Next Scheduled Appointment</div>
          <div className="appt-card card">
            {[
              { label: 'Date',       value: patient.nextAppointment.date       },
              { label: 'Time',       value: patient.nextAppointment.time       },
              { label: 'Department', value: patient.nextAppointment.department },
              { label: 'Doctor',     value: patient.nextAppointment.doctor     },
            ].map(({ label, value }) => (
              <div key={label} className="appt-field">
                <span className="appt-field-label">{label}</span>
                <span className="appt-field-value">{value}</span>
              </div>
            ))}
          </div>

        </div>
      )}

      {/* ══════════════════════════════════════════════════════
          TAB: RISKS & GAPS
         ══════════════════════════════════════════════════════ */}
      {tab === 'risks' && (
        <div className="tab-panel animate-fadeIn">

          {/* Risk score bar */}
          <div className="risk-bar-card card">
            <div className="rbc-left">
              <span className="rbc-label">Overall Risk Score</span>
              <span className="rbc-score mono">{analysis.riskScore}</span>
              <span className="rbc-out mono">/100</span>
            </div>
            <div className="rbc-track-wrap">
              <div className="rbc-track">
                <div
                  className="rbc-fill"
                  style={{
                    width: `${analysis.riskScore}%`,
                    background: analysis.riskScore >= 70
                      ? 'linear-gradient(90deg,#D64545,#C03838)'
                      : analysis.riskScore >= 40
                      ? 'linear-gradient(90deg,#E6A23C,#CC8C2A)'
                      : 'linear-gradient(90deg,#4CAF7D,#3D9B6A)',
                  }}
                />
              </div>
              <div className="rbc-labels">
                <span style={{ color: 'var(--safe)' }}>Low</span>
                <span style={{ color: 'var(--warning)' }}>Medium</span>
                <span style={{ color: 'var(--critical)' }}>High</span>
              </div>
            </div>
            <span className={`risk-pill rp-${analysis.riskLevel.toLowerCase()}`}>
              {analysis.riskLevel} RISK
            </span>
          </div>

          <div className="alerts-stack">
            {analysis.alerts.map((a, i) => (
              <AlertRow key={a.id} alert={a} index={i} />
            ))}
          </div>

        </div>
      )}

      {/* ══════════════════════════════════════════════════════
          TAB: TRENDS
         ══════════════════════════════════════════════════════ */}
      {tab === 'trends' && (
        <div className="tab-panel animate-fadeIn">

          {/* BP Chart */}
          <div className="chart-card card">
            <div className="chart-hdr">
              <div>
                <div className="chart-title">Blood Pressure Trend (24 hrs)</div>
                <div className="chart-sub">Systolic / Diastolic mmHg over time</div>
              </div>
              <TrendBadge trend={analysis.bpTrend} />
            </div>
            <ResponsiveContainer width="100%" height={240}>
              <LineChart data={patient.bpHistory} margin={{ top: 10, right: 20, left: -10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border-subtle)" />
                <XAxis dataKey="time" tick={{ fontSize: 11, fill: 'var(--text-muted)' }} stroke="var(--border)" />
                <YAxis domain={[60, 200]} tick={{ fontSize: 11, fill: 'var(--text-muted)' }} stroke="var(--border)" />
                <ReTooltip content={<ChartTip />} />
                <Legend wrapperStyle={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }} />
                <ReferenceLine y={140} stroke={`${CSS.escape ? '#D6454566' : 'rgba(214,69,69,0.4)'}`} strokeDasharray="4 3" label={{ value: 'High', fill: '#D64545', fontSize: 10 }} />
                <ReferenceLine y={120} stroke="rgba(230,162,60,0.4)" strokeDasharray="4 3" label={{ value: 'Normal', fill: '#E6A23C', fontSize: 10 }} />
                <Line
                  type="monotone" dataKey="systolic" name="Systolic"
                  stroke="#D64545" strokeWidth={2.5}
                  dot={{ fill: '#D64545', r: 4, strokeWidth: 0 }}
                  activeDot={{ r: 6 }}
                  animationDuration={800}
                />
                <Line
                  type="monotone" dataKey="diastolic" name="Diastolic"
                  stroke="#E6A23C" strokeWidth={2.5}
                  dot={{ fill: '#E6A23C', r: 4, strokeWidth: 0 }}
                  activeDot={{ r: 6 }}
                  animationDuration={1000}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>

          {/* HR Chart */}
          <div className="chart-card card" style={{ marginTop: 16 }}>
            <div className="chart-hdr">
              <div>
                <div className="chart-title">Heart Rate Trend (24 hrs)</div>
                <div className="chart-sub">Beats per minute over observation period</div>
              </div>
              <TrendBadge trend={analysis.hrTrend} />
            </div>
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={patient.hrHistory} margin={{ top: 10, right: 20, left: -10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border-subtle)" />
                <XAxis dataKey="time" tick={{ fontSize: 11, fill: 'var(--text-muted)' }} stroke="var(--border)" />
                <YAxis domain={[60, 140]} tick={{ fontSize: 11, fill: 'var(--text-muted)' }} stroke="var(--border)" />
                <ReTooltip content={<ChartTip />} />
                <ReferenceLine y={100} stroke="rgba(230,162,60,0.5)" strokeDasharray="4 3" label={{ value: 'Tachycardia', fill: '#E6A23C', fontSize: 10 }} />
                <Line
                  type="monotone" dataKey="hr" name="Heart Rate (bpm)"
                  stroke="#D64545" strokeWidth={2.5}
                  dot={{ fill: '#D64545', r: 4, strokeWidth: 0 }}
                  activeDot={{ r: 6 }}
                  animationDuration={900}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>

        </div>
      )}

      {/* ══════════════════════════════════════════════════════
          TAB: LABS & MEDS
         ══════════════════════════════════════════════════════ */}
      {tab === 'labs' && (
        <div className="tab-panel animate-fadeIn">

          <div className="section-label">Laboratory Results</div>
          <div className="labs-wrap card">
            <table className="labs-table">
              <thead>
                <tr>
                  <th>Test</th>
                  <th>Value</th>
                  <th>Unit</th>
                  <th>Normal Range</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {patient.labs.map(lab => (
                  <tr key={lab.name} className={`lab-tr lab-${lab.status}`}>
                    <td className="lab-name">{lab.name}</td>
                    <td className="lab-val mono">{lab.value}</td>
                    <td className="lab-unit">{lab.unit}</td>
                    <td className="lab-ref">{lab.normal}</td>
                    <td>
                      <span className={`badge ${lab.status === 'normal' ? 'badge-safe' : 'badge-critical'}`}>
                        {lab.status.toUpperCase()}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="section-label" style={{ marginTop: 22 }}>Medication Schedule</div>
          <div className="meds-stack">
            {patient.medications.map(med => (
              <div key={med.name} className={`med-row card med-${med.status}`}>
                <div className={`med-icon-wrap med-icon-${med.status}`}>
                  <Pill size={15} strokeWidth={2} />
                </div>
                <div className="med-info">
                  <div className="med-name">{med.name}</div>
                  {med.note && <div className="med-note">{med.note}</div>}
                </div>
                <div className="med-right">
                  {med.time && <span className="med-time mono">{med.time}</span>}
                  <span className={`badge ${med.status === 'administered' ? 'badge-safe' : med.status === 'missed' ? 'badge-critical' : 'badge-warning'}`}>
                    {med.status.toUpperCase()}
                  </span>
                </div>
              </div>
            ))}
          </div>

        </div>
      )}

    </main>
  );
}
