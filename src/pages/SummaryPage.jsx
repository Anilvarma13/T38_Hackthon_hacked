import React, { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ChevronRight, Shield, Zap, TrendingUp,
  Printer, AlertTriangle, CheckCircle
} from 'lucide-react';
import { AppContext } from '../App';
import { analyzeRisks }    from '../data/riskEngine';
import './SummaryPage.css';

/* ── Circular Risk Gauge ──────────────────────────────────── */
function CircularGauge({ score, level }) {
  const radius = 54;
  const circ   = 2 * Math.PI * radius;
  const fill   = circ - (score / 100) * circ;

  const color = level === 'HIGH'   ? '#D64545'
              : level === 'MEDIUM' ? '#E6A23C'
              :                      '#4CAF7D';

  return (
    <div className="gauge-wrap">
      <svg viewBox="0 0 128 128" className="gauge-svg" aria-label={`Risk score ${score} out of 100`}>
        {/* Track */}
        <circle
          cx="64" cy="64" r={radius}
          fill="none"
          stroke="var(--bg-warm)"
          strokeWidth="12"
        />
        {/* Fill */}
        <circle
          cx="64" cy="64" r={radius}
          fill="none"
          stroke={color}
          strokeWidth="12"
          strokeLinecap="round"
          strokeDasharray={circ}
          strokeDashoffset={fill}
          transform="rotate(-90 64 64)"
          style={{ transition: 'stroke-dashoffset 1.2s cubic-bezier(0.4,0,0.2,1)', filter: `drop-shadow(0 0 6px ${color}55)` }}
        />
        {/* Score text */}
        <text x="64" y="61" textAnchor="middle" fill={color} fontSize="22" fontWeight="800" fontFamily="JetBrains Mono">
          {score}
        </text>
        <text x="64" y="75" textAnchor="middle" fill="var(--text-muted)" fontSize="8.5" letterSpacing="1.5" fontFamily="Inter">
          RISK SCORE
        </text>
      </svg>
    </div>
  );
}

/* ── Smart Insight Card ───────────────────────────────────── */
function InsightCard({ icon: Icon, color, bg, border, title, body, delay }) {
  return (
    <div
      className="insight-card card"
      style={{
        background: bg,
        borderColor: border,
        animationDelay: `${delay}s`,
      }}
    >
      <div className="ic-icon" style={{ background: color + '22', color }}>
        <Icon size={18} strokeWidth={2} />
      </div>
      <div className="ic-title">{title}</div>
      <div className="ic-body">{body}</div>
    </div>
  );
}

/* ── Action Item ──────────────────────────────────────────── */
function ActionItem({ text, urgent, index }) {
  return (
    <div
      className={`action-item ${urgent ? 'action-urgent' : 'action-std'}`}
      style={{ animationDelay: `${index * 0.05}s` }}
    >
      <div className={`action-dot ${urgent ? 'ad-urgent' : 'ad-std'}`}>
        {urgent ? <Zap size={11} /> : <CheckCircle size={11} />}
      </div>
      <span>{text}</span>
    </div>
  );
}

/* ════════════════════════════════════════════════════════════
   SUMMARY PAGE
   ════════════════════════════════════════════════════════════ */
export default function SummaryPage() {
  const navigate = useNavigate();
  const { patientData } = React.useContext(AppContext);

  const patient = patientData || require('../data/mockPatientData').mockPatientData;
  const analysis = useMemo(() => analyzeRisks(patient), [patient]);

  const critical = analysis.alerts.filter(a => a.level === 'critical');
  const warnings = analysis.alerts.filter(a => a.level === 'warning');
  const missing  = analysis.alerts.filter(a => a.level === 'missing');

  const urgentActions  = analysis.recommendations.slice(0, 3);
  const followupActions = analysis.recommendations.slice(3);

  /* Smart insight cards */
  const insights = [];

  if (analysis.riskScore >= 70) {
    insights.push({
      icon: AlertTriangle,
      color: '#D64545',
      bg: 'var(--critical-light)',
      border: 'var(--critical-border)',
      title: 'Condition Deteriorating',
      body: 'Multiple critical indicators are present simultaneously. Immediate escalation is recommended.',
    });
  }
  if (analysis.bpTrend === 'increasing') {
    insights.push({
      icon: TrendingUp,
      color: '#E6A23C',
      bg: 'var(--warning-light)',
      border: 'var(--warning-border)',
      title: 'Blood Pressure Rising',
      body: 'Systolic BP has trended upward over the last 20 hours despite antihypertensive therapy.',
    });
  }
  if (critical.length >= 2) {
    insights.push({
      icon: Shield,
      color: '#D64545',
      bg: 'var(--critical-light)',
      border: 'var(--critical-border)',
      title: 'High Risk of Complication',
      body: 'Combined cardiac biomarker elevation, tachycardia, and medication gap increases complication risk significantly.',
    });
  }
  if (analysis.hrTrend === 'unstable') {
    insights.push({
      icon: Zap,
      color: '#E6A23C',
      bg: 'var(--warning-light)',
      border: 'var(--warning-border)',
      title: 'Unstable Heart Rate Pattern',
      body: 'Heart rate is fluctuating and has not stabilised — possible arrhythmia or inadequate rate control.',
    });
  }

  return (
    <main className="summary-page page">

      <div className="page-header animate-fadeUp">
        <h1 className="page-title">Smart Insights & Handoff Summary</h1>
        <p className="page-subtitle">AI-generated clinical intelligence ready for safe shift transfer</p>
      </div>

      {/* ── Top Row: Gauge + Stats ──────────────────────────── */}
      <div className="sum-top animate-fadeUp stagger-1">

        {/* Gauge card */}
        <div className="card gauge-card">
          <div className="section-label">Risk Assessment</div>
          <CircularGauge score={analysis.riskScore} level={analysis.riskLevel} />
          <div className={`risk-level-pill rp-${analysis.riskLevel.toLowerCase()}`}>
            <Shield size={14} strokeWidth={2.5} />
            {analysis.riskLevel} RISK
          </div>
          <p className="gauge-desc">
            {analysis.riskLevel === 'HIGH'
              ? 'Multiple critical indicators. Immediate attention required.'
              : analysis.riskLevel === 'MEDIUM'
              ? 'Significant warnings detected. Close monitoring advised.'
              : 'Relatively stable. Routine handoff adequate.'}
          </p>
        </div>

        {/* Stat cards */}
        <div className="sum-stat-grid">
          {[
            { label: 'Critical Alerts', count: critical.length, cls: 'stat-critical', icon: '🔴' },
            { label: 'Warnings',        count: warnings.length, cls: 'stat-warning',  icon: '🟡' },
            { label: 'Info Gaps',       count: missing.length,  cls: 'stat-missing',  icon: '⚠️' },
            { label: 'Risk Score',      count: analysis.riskScore, cls: 'stat-score', icon: '/100' },
          ].map(({ label, count, cls, icon }) => (
            <div key={label} className={`stat-card card ${cls}`}>
              <span className="stat-num mono">{count}</span>
              <span className="stat-icon">{icon}</span>
              <span className="stat-label">{label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* ── Smart Insights ─────────────────────────────────── */}
      {insights.length > 0 && (
        <section className="animate-fadeUp stagger-2">
          <div className="section-label">Smart Insights</div>
          <div className="insights-grid">
            {insights.map((ins, i) => (
              <InsightCard key={ins.title} {...ins} delay={i * 0.07} />
            ))}
          </div>
        </section>
      )}

      {/* ── Key Concerns ────────────────────────────────────── */}
      <div className="card concerns-card animate-fadeUp stagger-2">
        <div className="section-label">Key Concerns at Handoff</div>
        <div className="concerns-list">
          {[...critical, ...warnings, ...missing].map(a => (
            <div key={a.id} className={`concern-row concern-${a.level}`}>
              <span className={`concern-dot cd-${a.level}`} />
              <div className="concern-body">
                <div className="concern-title">{a.title}</div>
                <div className="concern-detail">{a.detail}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ── Missed Action Tracker ─────────────────────────── */}
      {patient.medications.some(m => m.status === 'missed' || m.status === 'pending') && (
        <div className="card missed-tracker animate-fadeUp stagger-3">
          <div className="section-label">
            <AlertTriangle size={12} style={{ color: 'var(--warning)' }} />
            Missed Action Tracker
          </div>
          <div className="missed-list">
            {patient.medications
              .filter(m => m.status !== 'administered')
              .map(med => (
                <div key={med.name} className={`missed-row missed-${med.status}`}>
                  <span className={`badge badge-${med.status === 'missed' ? 'critical' : 'warning'}`}>
                    {med.status === 'missed' ? 'SKIPPED' : 'PENDING'}
                  </span>
                  <span className="missed-med-name">{med.name}</span>
                  {med.note && <span className="missed-med-note">{med.note}</span>}
                </div>
              ))}
          </div>
        </div>
      )}

      {/* ── Actions ─────────────────────────────────────────── */}
      <div className="sum-actions-row animate-fadeUp stagger-3">
        <div className="card actions-card">
          <div className="section-label">
            <Zap size={12} style={{ color: 'var(--critical)' }} />
            Immediate Actions Required
          </div>
          <div className="action-list">
            {urgentActions.map((a, i) => (
              <ActionItem key={i} text={a} urgent={true} index={i} />
            ))}
          </div>
        </div>

        <div className="card actions-card">
          <div className="section-label">
            <TrendingUp size={12} style={{ color: 'var(--warning)' }} />
            Follow-Up Actions
          </div>
          <div className="action-list">
            {followupActions.length > 0
              ? followupActions.map((a, i) => <ActionItem key={i} text={a} urgent={false} index={i} />)
              : <p className="no-action">No additional follow-up actions required.</p>
            }
          </div>
        </div>
      </div>

      {/* ── Trend Details ─────────────────────────────────── */}
      <div className="card trend-details animate-fadeUp stagger-4">
        <div className="section-label">Trend Details</div>
        <div className="ts-row">
          {[
            { label: 'BP Trend', val: analysis.bpTrend === 'increasing' ? '↑ Increasing' : analysis.bpTrend === 'unstable' ? '⚡ Unstable' : analysis.bpTrend === 'stable' ? '✓ Stable' : '→ Variable', warn: analysis.bpTrend !== 'stable' && analysis.bpTrend !== 'decreasing' },
            { label: 'HR Trend', val: analysis.hrTrend === 'increasing' ? '↑ Escalating' : analysis.hrTrend === 'unstable' ? '⚡ Fluctuating' : analysis.hrTrend === 'stable' ? '✓ Controlled' : '→ Monitoring', warn: analysis.hrTrend === 'unstable' || analysis.hrTrend === 'increasing' },
            { label: 'Echo Status', val: `⏳ ${patient.echoStatus.charAt(0).toUpperCase() + patient.echoStatus.slice(1)}`, warn: true },
            { label: 'Last Check',  val: new Date(patient.lastVitalsUpdate).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }), warn: false },
            { label: 'Next Check',  val: (() => { const d = new Date(patient.lastVitalsUpdate); d.setHours(d.getHours() + 1); return d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }); })(), warn: false },
          ].map(({ label, val, warn }, i, arr) => (
            <React.Fragment key={label}>
              <div className="ts-item">
                <span className="ts-label">{label}</span>
                <span className={`ts-val ${warn ? 'ts-warn' : 'ts-ok'}`}>{val}</span>
              </div>
              {i < arr.length - 1 && <div className="ts-sep" />}
            </React.Fragment>
          ))}
        </div>
      </div>

      {/* ── CTAs ────────────────────────────────────────────── */}
      <div className="sum-ctas no-print animate-fadeUp stagger-4">
        <button id="goto-handoff-btn" className="btn btn-critical btn-lg" onClick={() => navigate('/handoff')}>
          <Shield size={17} />
          Transfer Case to Handoff
          <ChevronRight size={16} />
        </button>
        <button id="print-btn" className="btn btn-outline" onClick={() => window.print()}>
          <Printer size={15} />
          Print Report
        </button>
        <button className="btn btn-ghost" onClick={() => navigate('/patient')}>
          ← Back to Patient
        </button>
      </div>

    </main>
  );
}
