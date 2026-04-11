import React, { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Stethoscope, Upload, Activity, BarChart3, Shield, Database } from 'lucide-react';
import './Navbar.css';

const STEPS = [
  { path: '/',         label: 'Upload',   icon: Upload    },
  { path: '/dashboard',label: 'Records',  icon: Database  },
  { path: '/patient',  label: 'Patient',  icon: Activity  },
  { path: '/summary',  label: 'Insights', icon: BarChart3 },
  { path: '/handoff',  label: 'Handoff',  icon: Shield    },
];

export default function Navbar() {
  const location  = useLocation();
  const navigate  = useNavigate();
  const [time, setTime] = useState(new Date());

  useEffect(() => {
    const id = setInterval(() => setTime(new Date()), 30000);
    return () => clearInterval(id);
  }, []);

  if (location.pathname === '/processing') return null;

  const activeIdx = STEPS.findIndex(s => s.path === location.pathname);

  return (
    <nav className="navbar" role="navigation" aria-label="Main navigation">
      <div className="navbar-inner">

        {/* Brand */}
        <button className="navbar-brand" onClick={() => navigate('/')} aria-label="Go to home">
          <div className="brand-icon">
            <Stethoscope size={17} strokeWidth={2.2} />
          </div>
          <div className="brand-text">
            <span className="brand-name">MediShift</span>
            <span className="brand-tagline">Clinical Handoff Intelligence</span>
          </div>
        </button>

        {/* Step Indicator */}
        <ol className="nav-steps" aria-label="Progress steps">
          {STEPS.map((step, idx) => {
            const Icon   = step.icon;
            const isActive = location.pathname === step.path;
            const isPast   = idx < activeIdx && activeIdx !== -1;
            return (
              <React.Fragment key={step.path}>
                {idx > 0 && (
                  <li className={`step-connector ${isPast || isActive ? 'filled' : ''}`} aria-hidden="true" />
                )}
                <li>
                  <button
                    className={`nav-step ${isActive ? 'active' : ''} ${isPast ? 'past' : ''}`}
                    onClick={() => navigate(step.path)}
                    aria-current={isActive ? 'step' : undefined}
                    id={`nav-step-${step.label.toLowerCase()}`}
                  >
                    <div className="step-circle">
                      {isPast ? '✓' : <Icon size={13} strokeWidth={2.4} />}
                    </div>
                    <span className="step-label">{step.label}</span>
                  </button>
                </li>
              </React.Fragment>
            );
          })}
        </ol>

        {/* Right info */}
        <div className="navbar-right">
          <div className="live-pill">
            <span className="live-dot" aria-hidden="true" />
            <span>Live</span>
          </div>
          <div className="nav-time" aria-label="Current time">
            {time.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
          </div>
        </div>

      </div>
    </nav>
  );
}
