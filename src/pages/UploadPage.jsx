import React, { useCallback, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Upload, FileText, Shield, Activity, AlertCircle,
  Zap, ChevronRight, CheckCircle, Database
} from 'lucide-react';
import { AppContext } from '../App';
import './UploadPage.css';

const FEATURES = [
  { icon: Zap,          color: '#5B8DEF', bg: '#F0F5FF', label: 'Auto Risk Detection',    desc: 'Flags elevated BP, abnormal HR, fever, and missed meds instantly.' },
  { icon: Activity,     color: '#4CAF7D', bg: '#F0FFF6', label: 'Trend Analysis',         desc: 'Visualizes vital trends over time. Detects rising or unstable patterns.' },
  { icon: AlertCircle,  color: '#E6A23C', bg: '#FFFBF0', label: 'Gap Identification',     desc: 'Detects missing allergy info, pending investigations, stale vitals.' },
  { icon: Shield,       color: '#D64545', bg: '#FFF0F0', label: 'Handoff Safety Lock',    desc: 'Generates a risk-scored handoff summary with doctor acknowledgment.' },
];

export default function UploadPage() {
  const navigate = useNavigate();
  const { setUploadedFile, setPatientData } = React.useContext(AppContext);
  const [isDragging, setIsDragging] = useState(false);
  const [selectedFile, setSelectedFile] = useState(null);
  const [error, setError] = useState('');
  const [isUploading, setIsUploading] = useState(false);

  const handleFile = useCallback((file) => {
    if (!file) return;
    if (file.type !== 'application/pdf' && !file.name.endsWith('.pdf')) {
      setError('Only PDF files are supported. Please upload a clinical PDF report.');
      return;
    }
    setError('');
    setSelectedFile(file);
    setUploadedFile(file);
  }, [setUploadedFile]);

  const onDrop     = (e) => { e.preventDefault(); setIsDragging(false); handleFile(e.dataTransfer.files[0]); };
  const onDragOver = (e) => { e.preventDefault(); setIsDragging(true);  };
  const onDragLeave = ()  => setIsDragging(false);
  const onInput    = (e) => handleFile(e.target.files[0]);

  const handleAnalyze = async () => {
    if (!selectedFile) { setError('Please select a patient PDF first.'); return; }
    
    setIsUploading(true);
    let formData = new FormData();
    formData.append('pdf', selectedFile);

    try {
      const response = await fetch('http://localhost:5000/api/upload', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json();
        setError(errorData.error || 'Failed to upload document');
        setIsUploading(false);
        return;
      }

      const data = await response.json();
      setPatientData(data);
      navigate('/processing');
    } catch (err) {
      console.error(err);
      setError('Network error while processing PDF. Ensure backend is running.');
      setIsUploading(false);
    }
  };

  const handleDemo = async () => {
    navigate('/dashboard');
  };

  return (
    <main className="upload-page page">

      {/* ── Hero ──────────────────────────────────────────────── */}
      <section className="upload-hero animate-fadeUp">
        <div className="hero-badge">
          <Shield size={13} strokeWidth={2.5} />
          <span>No Manual Data Entry</span>
        </div>
        <h1 className="hero-title">
          Intelligent Clinical<br />
          <span className="hero-accent">Handoff Risk Detection</span>
        </h1>
        <p className="hero-desc">
          Upload any patient clinical document — lab report, discharge summary, or clinical notes.
          MediShift structures the data and surfaces every critical risk before your shift ends.
        </p>
      </section>

      {/* ── Upload Card ───────────────────────────────────────── */}
      <section className="upload-card-wrap animate-fadeUp stagger-1">
        <div
          className={`upload-zone ${isDragging ? 'dragging' : ''} ${selectedFile ? 'has-file' : ''}`}
          onDrop={onDrop}
          onDragOver={onDragOver}
          onDragLeave={onDragLeave}
          onClick={() => !selectedFile && document.getElementById('pdf-input').click()}
          role="button"
          tabIndex={0}
          id="upload-zone"
          aria-label="Upload patient PDF"
          onKeyDown={(e) => e.key === 'Enter' && document.getElementById('pdf-input').click()}
        >
          {selectedFile ? (
            /* ── File selected state */
            <div className="file-ready">
              <div className="file-ready-icon">
                {isUploading ? <div className="dot-spinner" style={{borderColor: 'var(--safe)', borderTopColor: 'transparent', width: 36, height: 36}}></div> : <CheckCircle size={36} strokeWidth={1.8} />}
              </div>
              <div className="file-ready-name">{selectedFile.name}</div>
              <div className="file-ready-meta">
                {(selectedFile.size / 1024).toFixed(0)} KB &nbsp;·&nbsp; PDF Document
              </div>
              <div className="badge badge-safe">{isUploading ? 'Encrypting & Uploading...' : '✓ Validated — Ready to Analyze'}</div>
              {!isUploading && <button
                className="btn btn-ghost file-change-btn"
                onClick={(e) => { e.stopPropagation(); setSelectedFile(null); setUploadedFile(null); }}
              >
                Change file
              </button>}
            </div>
          ) : (
            /* ── Drop zone placeholder */
            <div className="drop-placeholder">
              <div className={`drop-icon-ring ${isDragging ? 'ring-active' : ''}`}>
                <Upload size={28} strokeWidth={1.8} />
              </div>
              <div className="drop-title">
                {isDragging ? 'Release to upload' : 'Drag & drop patient PDF here'}
              </div>
              <div className="drop-sub">or click to browse files</div>
              <div className="drop-types">
                {['Lab Report', 'Discharge Summary', 'Clinical Notes', 'Radiology Report'].map(t => (
                  <span key={t} className="type-chip">{t}</span>
                ))}
              </div>
            </div>
          )}

          <input type="file" id="pdf-input" accept=".pdf,application/pdf" hidden onChange={onInput} />
        </div>

        {/* Error */}
        {error && (
          <div className="upload-error animate-scaleIn">
            <AlertCircle size={15} />
            {error}
          </div>
        )}

        {/* Actions */}
        <div className="upload-actions">
          <button
            id="analyze-btn"
            className="btn btn-primary btn-lg"
            onClick={handleAnalyze}
            disabled={!selectedFile || isUploading}
          >
            {isUploading ? <Activity size={17} className="animate-spin" /> : <Activity size={17} />}
            {isUploading ? 'Processing...' : 'Analyze Report'}
            <ChevronRight size={16} />
          </button>
          <button id="demo-btn" className="btn btn-outline" onClick={handleDemo}>
            <Database size={15} />
            View Saved Records
          </button>
        </div>
      </section>

      {/* ── Feature Grid ──────────────────────────────────────── */}
      <section className="feature-grid animate-fadeUp stagger-2">
        {FEATURES.map(({ icon: Icon, color, bg, label, desc }, i) => (
          <div key={label} className="feature-card card" style={{ animationDelay: `${i * 0.07}s` }}>
            <div className="feature-icon" style={{ background: bg, color }}>
              <Icon size={20} strokeWidth={2} />
            </div>
            <div className="feature-label">{label}</div>
            <div className="feature-desc">{desc}</div>
          </div>
        ))}
      </section>

    </main>
  );
}
