import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import './ProcessingPage.css';

const STEPS = [
  {
    icon: '📄',
    label: 'Extracting clinical information',
    detail: 'Reading patient demographics, vitals, medications, and history from the uploaded document...',
    duration: 1900,
  },
  {
    icon: '📊',
    label: 'Structuring patient data',
    detail: 'Organising vitals, lab results, clinical notes, and medication schedule into structured format...',
    duration: 1700,
  },
  {
    icon: '🚨',
    label: 'Detecting risks & clinical gaps',
    detail: 'Identifying abnormal values, missed medications, missing information, and time-based alerts...',
    duration: 2100,
  },
  {
    icon: '📈',
    label: 'Analysing vital trends',
    detail: 'Computing BP/HR patterns, detecting increasing trends, unstable readings, and deterioration signals...',
    duration: 1500,
  },
];

export default function ProcessingPage() {
  const navigate = useNavigate();
  const [current, setCurrent]     = useState(0);
  const [completed, setCompleted] = useState([]);
  const [done, setDone]           = useState(false);

  const total = STEPS.reduce((s, x) => s + x.duration, 0);

  useEffect(() => {
    let acc = 0;
    STEPS.forEach((step, i) => {
      setTimeout(() => setCurrent(i), acc);
      acc += step.duration;
      setTimeout(() => setCompleted(p => [...p, i]), acc);
    });
    setTimeout(() => {
      setDone(true);
      setTimeout(() => navigate('/patient'), 700);
    }, acc + 400);
  }, [navigate]);

  let elapsed = 0;
  STEPS.slice(0, current).forEach(s => { elapsed += s.duration; });
  if (completed.includes(current)) elapsed += STEPS[current]?.duration ?? 0;
  const progress = Math.min(Math.round((elapsed / total) * 100), 100);

  return (
    <div className="proc-page">

      {/* Ambient warm circles */}
      <div className="proc-orb proc-orb-1" />
      <div className="proc-orb proc-orb-2" />

      <div className="proc-card">

        {/* Header icon */}
        <div className={`proc-icon-wrap ${done ? 'done' : ''}`}>
          <div className="proc-icon-ring ring-a" />
          <div className="proc-icon-ring ring-b" />
          <span className="proc-icon-emoji">{done ? '✅' : '🧠'}</span>
        </div>

        <h1 className="proc-title">
          {done ? 'Analysis Complete' : 'Processing Patient Data'}
        </h1>
        <p className="proc-subtitle">
          {done
            ? 'All risks detected. Redirecting to patient view...'
            : 'MediShift is extracting and analysing clinical information from the uploaded PDF.'}
        </p>

        {/* Progress bar */}
        <div className="proc-progress">
          <div className="proc-bar-track">
            <div
              className="proc-bar-fill"
              style={{ width: `${progress}%` }}
            />
          </div>
          <span className="proc-pct mono">{progress}%</span>
        </div>

        {/* Steps */}
        <ol className="proc-steps">
          {STEPS.map((step, i) => {
            const isDone    = completed.includes(i);
            const isActive  = current === i && !isDone;
            const isPending = i > current;

            return (
              <li
                key={i}
                className={`proc-step ${isDone ? 'step-done' : ''} ${isActive ? 'step-active' : ''} ${isPending ? 'step-pending' : ''}`}
                style={{ animationDelay: `${i * 0.08}s` }}
              >
                {/* Status dot */}
                <div className="proc-step-dot">
                  {isDone   && <span className="dot-check">✓</span>}
                  {isActive && <div className="dot-spinner" />}
                  {isPending && <span className="dot-num">{i + 1}</span>}
                </div>

                {/* Text */}
                <div className="proc-step-body">
                  <div className="proc-step-label">
                    <span className="proc-step-emoji">{step.icon}</span>
                    {step.label}
                  </div>
                  {isActive && (
                    <div className="proc-step-detail animate-fadeIn">
                      {step.detail}
                    </div>
                  )}
                  {isDone && <div className="proc-step-done">Completed</div>}
                </div>
              </li>
            );
          })}
        </ol>

      </div>
    </div>
  );
}
