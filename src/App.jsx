import React, { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  UploadCloud, Activity, User, AlertCircle, Sparkles, Download, 
  RefreshCw, XOctagon, LayoutDashboard, TrendingUp, FileCheck, Stethoscope, Clock, Trash2, ChevronRight, Search, Filter, LogOut, MessageSquare, Power
} from 'lucide-react';
import Login from './Login';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer } from 'recharts';

export default function App() {
  const [activeTab, setActiveTab] = useState('upload'); // 'upload' | 'risk' | 'trends' | 'handoff'
  const [appState, setAppState] = useState('idle'); // 'idle' | 'processing' | 'results'
  const [results, setResults] = useState(null);
  const [isDragActive, setIsDragActive] = useState(false);
  const [history, setHistory] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [authUser, setAuthUser] = useState(() => {
    const saved = localStorage.getItem('auth_user');
    return saved ? JSON.parse(saved) : null;
  });
  const [doctorNote, setDoctorNote] = useState('');
  const [isLiveMonitorActive, setIsLiveMonitorActive] = useState(false);
  const [liveAlerts, setLiveAlerts] = useState([]);
  const [missingTests, setMissingTests] = useState([]);
  const [aiRecommendation, setAiRecommendation] = useState(null);
  const fileInputRef = useRef(null);
  const liveIntervalRef = useRef(null);
  const prevVitalsRef = useRef(null);

  const getHeaders = () => {
    return {
      'Authorization': `Bearer ${localStorage.getItem('auth_token')}`,
      'Content-Type': 'application/json'
    };
  };

  const resetFlow = () => {
    setResults(null);
    setIsLiveMonitorActive(false);
    setAppState('idle');
    setActiveTab('upload');
  };

  const handleLogout = () => {
    localStorage.removeItem('auth_user');
    localStorage.removeItem('auth_token');
    setIsLiveMonitorActive(false);
    setAuthUser(null);
    resetFlow();
  };

  const fetchHistory = async () => {
    if(!authUser) return;
    try {
      const res = await fetch('http://localhost:4000/api/v1/reports', { headers: getHeaders() });
      if(res.status === 401) return handleLogout();
      const data = await res.json();
      setHistory(data);
    } catch (e) {
      console.error('Failed to fetch history', e);
    }
  };

  const deleteReport = async (e, id) => {
    e.stopPropagation();
    try {
      if(confirm('Delete this report permanently?')) {
        await fetch(`http://localhost:4000/api/v1/reports/${id}`, { method: 'DELETE', headers: getHeaders() });
        fetchHistory();
        if(results?._id === id) resetFlow();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const loadReport = async (report) => {
    // Reconstruct into original structure so the app functions perfectly
    const reconstructed = {
      _id: report._id,
      patientInfo: {
        name: report.patient_name,
        age: report.age,
        gender: report.gender,
        reportDate: report.report_date
      },
      medicalData: report.vitals || {},
      riskAssessment: {
        score: report.risk_score,
        reasons: report.risks?.map(r => r.explanation) || []
      },
      missedActions: report.missed_actions || [],
      doctorNotes: report.doctor_notes || [],
      trends: report.trends || [],
      aiSummary: report.ai_summary || ''
    };
    setResults(reconstructed);
    setAppState('results');
    setActiveTab('patient');
  };

  const uploadFile = async (file) => {
    setAppState('processing');
    const formData = new FormData();
    formData.append('file', file);

    try {
      const res = await fetch('http://localhost:4000/api/v1/analyze', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${localStorage.getItem('auth_token')}` },
        body: formData,
      });
      
      const data = await res.json();
      if (res.ok) {
        setResults(data);
        setAppState('results');
        fetchHistory(); // Refresh history with new report
        // Stay on Tab 1 to show Demographics, but unlock other tabs.
      } else {
        alert("Verification Error: " + (data.error || 'Unknown error occurred'));
        setAppState('idle');
      }
    } catch (err) {
      console.error(err);
      alert("Failed to connect to AI Server. Ensure backend is running on port 4000.");
      setAppState('idle');
    }
  };

  const addDoctorNote = async () => {
    if(!doctorNote.trim() || !results?._id) return;
    try {
      const res = await fetch(`http://localhost:4000/api/v1/reports/${results._id}/notes`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({ note: doctorNote })
      });
      if(res.ok) {
        const data = await res.json();
        setResults({ ...results, doctorNotes: data.doctor_notes });
        setDoctorNote('');
      }
    } catch(e) {}
  };

  React.useEffect(() => {
    if (isLiveMonitorActive && results) {
      liveIntervalRef.current = setInterval(() => {
        setResults(prev => {
          if(!prev) return prev;
          
          const mutate = (val, maxShift) => {
            if(!val) return val;
            const num = parseFloat(String(val).replace(/[^0-9.]/g, ''));
            if(isNaN(num)) return val;
            const shift = (Math.random() * maxShift * 2) - maxShift;
            return (num + shift).toFixed(1) + String(val).replace(/[0-9.]/g, '');
          };

          const newVitals = {
            ...prev.medicalData,
            oxygenLevel: mutate(prev.medicalData.oxygenLevel, 1),
            bloodPressure: mutate(prev.medicalData.bloodPressure?.split('/')[0], 5) + '/' + (prev.medicalData.bloodPressure?.split('/')[1] || '80'),
            heartRate: mutate(prev.medicalData.heartRate, 3),
            sugarLevel: mutate(prev.medicalData.sugarLevel, 5),
            hemoglobin: mutate(prev.medicalData.hemoglobin, 0.2)
          };

          const activeAlerts = [];
          const o2 = parseFloat(newVitals.oxygenLevel) || 98;
          const bpSys = parseFloat(newVitals.bloodPressure?.split('/')[0]) || 120;
          const sugar = parseFloat(newVitals.sugarLevel) || 100;
          const hemo = parseFloat(newVitals.hemoglobin) || 14;

          // Sudden Deterioration Detection
          if (prevVitalsRef.current) {
            const oldO2 = parseFloat(prevVitalsRef.current.oxygenLevel) || 98;
            if (oldO2 - o2 > 2) { // Sensitivity adjusted for demo
              activeAlerts.push({ 
                title: '🔴 DETERIORATION DETECTED', 
                dataPoint: `O2: ${oldO2}% ➔ ${o2}%`, 
                level: 'critical', 
                explanation: 'Rapid oxygen decline detected in short interval. Immediate clinical response mandatory.'
              });
            }
            const oldBP = parseFloat(prevVitalsRef.current.bloodPressure?.split('/')[0]) || 120;
            if (bpSys - oldBP > 15) {
              activeAlerts.push({ 
                title: '🔴 DETERIORATION DETECTED', 
                dataPoint: `BP: ${oldBP} ➔ ${bpSys}`, 
                level: 'critical', 
                explanation: 'Sudden hypertensive crisis detected.'
              });
            }
          }
          prevVitalsRef.current = newVitals;

          if (o2 < 92) activeAlerts.push({ title: 'Critical Hypoxia Alert', dataPoint: `O2: ${o2}%`, level: 'critical', explanation: 'Oxygen saturation below safe threshold.'});
          if (bpSys > 140) activeAlerts.push({ title: 'Hypertension Spike', dataPoint: `BP: ${bpSys}`, level: 'warning', explanation: 'Blood pressure elevating rapidly.'});
          if (sugar > 180) activeAlerts.push({ title: 'Hyperglycemia Detected', dataPoint: `Sugar: ${sugar}`, level: 'critical', explanation: 'Blood glucose exceeded threshold.'});
          if (hemo < 12) activeAlerts.push({ title: 'Anemia Warning', dataPoint: `Hemo: ${hemo}`, level: 'warning', explanation: 'Hemoglobin levels critically low.'});

          setLiveAlerts(activeAlerts);

          // Update trends for real-time charting
          const timestamp = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
          const newTrends = [...(prev.trends || [])];
          newTrends.push({ time: timestamp, hemoglobin: hemo, oxygen: o2, bp: bpSys });
          if(newTrends.length > 20) newTrends.shift(); // Keep last 20 points

          // Update risk score
          let newScore = 'LOW';
          if(activeAlerts.some(a => a.level === 'warning')) newScore = 'MEDIUM';
          if(activeAlerts.some(a => a.level === 'critical')) newScore = 'CRITICAL';

          // Generate AI Recommendation
          let rec = null;
          if (newScore === 'CRITICAL' && o2 < 93) rec = { action: 'ICU admission recommended', reason: 'Rapid condition deterioration + critical vital clusters.' };
          else if (newScore === 'CRITICAL' || sugar > 180) rec = { action: 'Consult specialist urgently', reason: 'Sustained abnormal vital trends detecting severe instability.' };
          else if (newScore === 'MEDIUM') rec = { action: 'Increase monitoring frequency', reason: 'Vitals showing moderate fluctuation from baseline.' };
          setAiRecommendation(rec);

          return {
            ...prev,
            medicalData: newVitals,
            trends: newTrends,
            riskAssessment: { ...prev.riskAssessment, score: newScore }
          };
        });
      }, 3500);
    } else {
      if (liveIntervalRef.current) clearInterval(liveIntervalRef.current);
      prevVitalsRef.current = null;
      setLiveAlerts([]);
      setMissingTests([]);
      setAiRecommendation(null);
    }
    return () => clearInterval(liveIntervalRef.current);
  }, [isLiveMonitorActive, results?._id]);

  React.useEffect(() => {
    fetchHistory();
  }, [authUser]);

  if (!authUser) {
    return <Login onLoginComplete={(u) => setAuthUser(u)} />;
  }

  return (
    <div className="layout-shell">
      {/* SIDEBAR NAVIGATION */}
      <aside className="sidebar">
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '0 8px', marginBottom: 32 }}>
          <div style={{ background: 'var(--brand-gradient)', color: '#fff', width: 32, height: 32, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Activity size={20} />
          </div>
          <div style={{ fontWeight: 700, fontSize: '1.25rem', letterSpacing: '-0.02em', color: '#0f172a' }}>MediShift AI</div>
        </div>

        <div style={{ padding: '0 16px', marginBottom: 24, paddingBottom: 24, borderBottom: '1px solid var(--border)' }}>
          <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Welcome back,</div>
          <div style={{ fontWeight: 600, color: '#0f172a' }}>Dr. {authUser.username}</div>
        </div>

        <nav className="sidebar-nav" style={{ marginTop: 0 }}>
          <div className={`nav-item ${activeTab === 'upload' ? 'active' : ''}`} onClick={() => setActiveTab('upload')}>
            <LayoutDashboard size={20} />
            <span>Upload & Analyze</span>
          </div>
          <div className={`nav-item ${activeTab === 'history' ? 'active' : ''}`} onClick={() => setActiveTab('history')}>
            <Clock size={20} />
            <span>Report History</span>
          </div>
          <div 
            className={`nav-item ${activeTab === 'patient' ? 'active' : ''} ${!results ? 'opacity-50 pointer-events-none' : ''}`} 
            style={!results ? { opacity: 0.5, cursor: 'not-allowed' } : {}}
            onClick={() => results && setActiveTab('patient')}
          >
            <User size={20} />
            <span>Patient Data</span>
          </div>

          {/* Lock subsequent tabs until results are present */}
          <div 
            className={`nav-item ${activeTab === 'risk' ? 'active' : ''} ${!results ? 'opacity-50 pointer-events-none' : ''}`} 
            style={!results ? { opacity: 0.5, cursor: 'not-allowed' } : {}}
            onClick={() => results && setActiveTab('risk')}
          >
            <AlertCircle size={20} />
            <span>Risk Intelligence</span>
          </div>

          <div 
            className={`nav-item ${activeTab === 'trends' ? 'active' : ''} ${!results ? 'opacity-50 pointer-events-none' : ''}`} 
            style={!results ? { opacity: 0.5, cursor: 'not-allowed' } : {}}
            onClick={() => results && setActiveTab('trends')}
          >
            <TrendingUp size={20} />
            <span>Trends & Analytics</span>
          </div>

          <div 
            className={`nav-item ${activeTab === 'handoff' ? 'active' : ''} ${!results ? 'opacity-50 pointer-events-none' : ''}`} 
            style={!results ? { opacity: 0.5, cursor: 'not-allowed' } : {}}
            onClick={() => results && setActiveTab('handoff')}
          >
            <FileCheck size={20} />
            <span>Handoff Report</span>
          </div>
        </nav>

        <div style={{ marginTop: 'auto', padding: '16px' }}>
          <button className="btn-secondary" onClick={handleLogout} style={{ width: '100%', border: 'none', background: '#fef2f2', color: '#dc2626' }}>
            <LogOut size={16} /> Secure Logout
          </button>
        </div>
      </aside>

      {/* MAIN CONTENT AREA */}
      <main className="main-content">
        
        {/* GLOBAL ICU BANNER */}
        {isLiveMonitorActive && results && (
          <div className="icu-banner pulse-text" style={{ position: 'sticky', top: 0, zIndex: 50, marginBottom: 24 }}>
            <Activity size={20} /> LIVE ICU MONITORING ACTIVE — Patient condition updating in real-time...
          </div>
        )}
        {isLiveMonitorActive && liveAlerts.some(a => a.level === 'critical') && (
          <div className="icu-banner critical pulse-text pulse-red-bg" style={{ position: 'sticky', top: 50, zIndex: 50, marginBottom: 24 }}>
            <AlertCircle size={24} /> 🔴 URGENT ALERT: Immediate attention required based on declining parameters.
          </div>
        )}

        <AnimatePresence mode="wait">
          
          {/* TAB 1: UPLOAD & ANALYZE */}
          {activeTab === 'upload' && (
            <motion.div key="tab1" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}>
              
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 40 }}>
                <h1 style={{ fontSize: '2rem', fontWeight: 700, color: '#0f172a' }}>Upload & Analyze</h1>
                {results && (
                  <button className="btn-secondary" onClick={resetFlow} style={{ fontSize: '0.875rem', padding: '8px 16px' }}>
                    <RefreshCw size={16}/> New Report
                  </button>
                )}
              </div>

              {appState === 'idle' && (
                <div className="glass-panel" style={{ padding: 40, textAlign: 'center', maxWidth: 600, margin: '0 auto' }}>
                  <input 
                    type="file" 
                    ref={fileInputRef} 
                    style={{ display: 'none' }} 
                    accept=".pdf,image/png,image/jpeg"
                    onChange={(e) => e.target.files?.length && uploadFile(e.target.files[0])}
                  />
                  <div 
                    className={`dropzone ${isDragActive ? 'active' : ''}`}
                    onDragOver={(e) => { e.preventDefault(); setIsDragActive(true); }}
                    onDragLeave={() => setIsDragActive(false)}
                    onDrop={(e) => { e.preventDefault(); setIsDragActive(false); if (e.dataTransfer.files?.length) uploadFile(e.dataTransfer.files[0]); }}
                    onClick={() => fileInputRef.current?.click()}
                  >
                    <div style={{ width: 64, height: 64, background: '#f1f5f9', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px', color: '#3b82f6' }}>
                      <UploadCloud size={32} />
                    </div>
                    <h3 style={{ fontSize: '1.25rem', fontWeight: 600, marginBottom: 8 }}>Drag & Drop Patient Report</h3>
                    <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginBottom: 24 }}>
                      Supported formats: PDF, JPG, PNG (Max 10MB)
                    </p>
                    <button className="btn-primary">Select File</button>
                  </div>
                </div>
              )}

              {appState === 'processing' && (
                <div style={{ textAlign: 'center', padding: '60px 0' }}>
                  <div className="pulsating-circle"><Activity size={40} strokeWidth={1.5} /></div>
                  <h2 style={{ fontSize: '1.5rem', fontWeight: 600, marginBottom: 8 }}>Validating Medical Report...</h2>
                  <p style={{ color: 'var(--text-secondary)', marginBottom: 40 }}>Extracting clinical data & verifying content parameters.</p>
                  <div style={{ maxWidth: 400, margin: '0 auto', textAlign: 'left', background: '#fff', padding: 24, borderRadius: 12, boxShadow: 'var(--shadow-sm)' }}>
                    <div className="skeleton" style={{ height: 12, width: '100%', marginBottom: 12 }}/>
                    <div className="skeleton" style={{ height: 12, width: '80%', marginBottom: 12 }}/>
                    <div className="skeleton" style={{ height: 12, width: '90%' }}/>
                  </div>
                </div>
              )}

              {appState === 'results' && results && (
                <div style={{ maxWidth: 800 }}>
                  <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '6px 12px', background: '#f0fdf4', color: '#16a34a', borderRadius: 999, fontWeight: 600, fontSize: '0.875rem', marginBottom: 24 }}>
                    <Activity size={16} /> Data Successfully Extracted
                  </div>
                  <h2 style={{ fontSize: '1.5rem', fontWeight: 600, marginBottom: 24 }}>Processing Complete</h2>
                  <div style={{ marginTop: 24, padding: 24, background: '#f8fafc', borderRadius: 12, border: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div>
                      <h3 style={{ fontWeight: 600, marginBottom: 4 }}>Proceed to Patient Data</h3>
                      <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>View the fully extracted medical data profile.</p>
                    </div>
                    <button className="btn-primary" onClick={() => setActiveTab('patient')}>View Patient Data</button>
                  </div>
                </div>
              )}
            </motion.div>
          )}

          {/* TAB: HISTORY */}
          {activeTab === 'history' && (
            <motion.div key="tabHistory" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 40 }}>
                <h1 style={{ fontSize: '2rem', fontWeight: 700, color: '#0f172a' }}>Patient History</h1>
              </div>

              <div className="card" style={{ padding: 24, marginBottom: 32, display: 'flex', gap: 16 }}>
                <div style={{ flex: 1, position: 'relative' }}>
                  <Search size={18} style={{ position: 'absolute', left: 16, top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }}/>
                  <input 
                    type="text" 
                    placeholder="Search by patient name..." 
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    style={{ width: '100%', padding: '12px 16px 12px 48px', border: '1px solid #e2e8f0', borderRadius: 8 }}
                  />
                </div>
                <button className="btn-secondary" onClick={fetchHistory} style={{ padding: '0 24px' }}>
                  <RefreshCw size={18} /> Refresh
                </button>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                {history.filter(h => h.patient_name?.toLowerCase().includes(searchQuery.toLowerCase())).map(report => (
                  <div key={report._id} className="card hover-lift" onClick={() => loadReport(report)} style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '24px 32px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 24 }}>
                      <div style={{ width: 48, height: 48, borderRadius: '50%', background: '#f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#3b82f6', fontWeight: 700, fontSize: '1.2rem' }}>
                        {report.patient_name ? report.patient_name.charAt(0).toUpperCase() : '?'}
                      </div>
                      <div>
                        <h3 style={{ fontSize: '1.25rem', fontWeight: 700, color: '#0f172a', marginBottom: 4 }}>{report.patient_name || 'Unknown Patient'}</h3>
                        <div style={{ display: 'flex', gap: 16, fontSize: '0.9rem', color: '#64748b' }}>
                          <span><strong style={{ color: '#475569' }}>Date:</strong> {new Date(report.created_at).toLocaleDateString()}</span>
                          <span><strong style={{ color: '#475569' }}>ID:</strong> {report._id.substring(0, 8)}...</span>
                        </div>
                      </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 32 }}>
                      <div style={{ padding: '6px 16px', borderRadius: 999, fontWeight: 700, fontSize: '0.85rem', ...({ 
                        HIGH: { background: '#fef2f2', color: '#dc2626'},
                        CRITICAL: { background: '#fef2f2', color: '#dc2626'},
                        MEDIUM: { background: '#fffbeb', color: '#d97706'},
                        LOW: { background: '#f0fdf4', color: '#16a34a'} 
                      }[report.risk_score || 'LOW'] || { background: '#f1f5f9', color: '#475569'}) }}>
                        {report.risk_score || 'LOW'} RISK
                      </div>
                      <button className="btn-secondary" style={{ padding: 8, color: '#ef4444', border: '1px solid #fee2e2', background: '#fef2f2' }} onClick={(e) => deleteReport(e, report._id)}>
                        <Trash2 size={18} />
                      </button>
                      <ChevronRight size={24} color="#cbd5e1" />
                    </div>
                  </div>
                ))}
                {history.length === 0 && (
                  <div style={{ textAlign: 'center', padding: 60, color: '#94a3b8' }}>
                    <Clock size={48} style={{ margin: '0 auto 16px', opacity: 0.5 }} />
                    <h3 style={{ fontSize: '1.25rem', fontWeight: 600, color: '#64748b' }}>No Upload History</h3>
                    <p style={{ marginTop: 8 }}>Analyzed reports will be saved securely here.</p>
                  </div>
                )}
              </div>
            </motion.div>
          )}

          {/* TAB 2: PATIENT DATA */}
          {activeTab === 'patient' && results && (
            <motion.div key="tab1.5" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 40 }}>
                <h1 style={{ fontSize: '2rem', fontWeight: 700, color: '#0f172a' }}>Extracted Patient Data</h1>
                <button 
                  onClick={() => setIsLiveMonitorActive(!isLiveMonitorActive)}
                  style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 20px', borderRadius: 999, fontWeight: 700, border: 'none', cursor: 'pointer', transition: 'all 0.3s', ...(!isLiveMonitorActive ? { background: '#10b981', color: 'white' } : { background: '#ef4444', color: 'white', animation: 'text-flash 1.5s infinite alternate' }) }}
                >
                  <Power size={18} /> {isLiveMonitorActive ? 'STOP ICU MONITOR' : 'START LIVE ICU MONITOR'}
                </button>
              </div>
              
              <div className="card" style={{ marginBottom: 32 }}>
                <h3 style={{ fontSize: '1.25rem', fontWeight: 600, marginBottom: 20, borderBottom: '1px solid #e2e8f0', paddingBottom: 12 }}>Demographics</h3>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
                  <div><div style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', marginBottom: 4 }}>Full Name</div><div style={{ fontSize: '1.125rem', fontWeight: 600 }}>{results.patientInfo?.name || 'Unknown'}</div></div>
                  <div><div style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', marginBottom: 4 }}>Age / Gender</div><div style={{ fontSize: '1.125rem', fontWeight: 600 }}>{results.patientInfo?.age || '?'} / {results.patientInfo?.gender || '?'}</div></div>
                  <div><div style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', marginBottom: 4 }}>Report Date</div><div style={{ fontSize: '1.125rem', fontWeight: 600 }}>{results.patientInfo?.reportDate || new Date().toLocaleDateString()}</div></div>
                </div>
              </div>

              <div className={`card ${isLiveMonitorActive ? 'pulse-red-bg' : ''}`} style={isLiveMonitorActive ? { transition: 'none' } : {}}>
                <h3 style={{ fontSize: '1.25rem', fontWeight: 600, marginBottom: 20, borderBottom: '1px solid #e2e8f0', paddingBottom: 12, display: 'flex', justifyContent: 'space-between' }}>
                  <span>Clinical Vitals & Diagnostics</span>
                  {isLiveMonitorActive && <span className="pulse-text" style={{ color: '#ef4444', fontSize: '0.875rem' }}>🔴 LIVE DATA</span>}
                </h3>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 24 }}>
                  <div><strong style={{ color: 'var(--text-secondary)' }}>Hemoglobin:</strong> <span style={{ fontWeight: 600, color: '#0f172a', transition: 'color 0.3s' }}>{results.medicalData?.hemoglobin || 'N/A'}</span></div>
                  <div><strong style={{ color: 'var(--text-secondary)' }}>Blood Pressure:</strong> <span style={{ fontWeight: 600, color: '#0f172a' }}>{results.medicalData?.bloodPressure || 'N/A'}</span></div>
                  <div><strong style={{ color: 'var(--text-secondary)' }}>Blood Sugar:</strong> <span style={{ fontWeight: 600, color: '#0f172a' }}>{results.medicalData?.sugarLevel || 'N/A'}</span></div>
                  <div><strong style={{ color: 'var(--text-secondary)' }}>Oxygen:</strong> <span style={{ fontWeight: 600, color: '#0f172a' }}>{results.medicalData?.oxygenLevel || 'N/A'}</span></div>
                  <div><strong style={{ color: 'var(--text-secondary)' }}>Heart Rate:</strong> <span style={{ fontWeight: 600, color: '#0f172a' }}>{results.medicalData?.heartRate || 'N/A'}</span></div>
                  <div><strong style={{ color: 'var(--text-secondary)' }}>Cholesterol:</strong> <span style={{ fontWeight: 600, color: '#0f172a' }}>{results.medicalData?.cholesterol || 'N/A'}</span></div>
                </div>

                <h4 style={{ fontWeight: 600, marginTop: 24, marginBottom: 8 }}>Diagnosis & Notes:</h4>
                <div style={{ background: '#f8fafc', padding: 16, borderRadius: 8 }}>
                  <p style={{ marginBottom: 12 }}><strong>Diagnosis:</strong> {results.medicalData?.diagnosis || 'No clear diagnosis extracted.'}</p>
                  <p><strong>Notes:</strong> {results.medicalData?.notes || 'None'}</p>
                </div>
                
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24, marginTop: 24 }}>
                  <div>
                    <h4 style={{ fontWeight: 600, marginBottom: 8 }}>Prescriptions:</h4>
                    <ul style={{ paddingLeft: 20 }}>{results.medicalData?.prescriptions?.map((p, i)=><li key={i}>{p}</li>) || <li>None found</li>}</ul>
                  </div>
                  <div>
                    <h4 style={{ fontWeight: 600, marginBottom: 8 }}>Recommended Tests:</h4>
                    <ul style={{ paddingLeft: 20 }}>{results.medicalData?.recommendedTests?.map((t, i)=><li key={i}>{t}</li>) || <li>None found</li>}</ul>
                  </div>
                </div>
              </div>
            </motion.div>
          )}

          {/* TAB 2: RISK INTELLIGENCE */}
          {activeTab === 'risk' && results && (
            <motion.div key="tab2" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}>
              <h1 style={{ fontSize: '2rem', fontWeight: 700, color: '#0f172a', marginBottom: 40 }}>Risk Intelligence Panel</h1>
              
              {/* AI NEXT ACTION RECOMMENDER PANEL */}
              {isLiveMonitorActive && aiRecommendation && (
                <div style={{ background: '#4c1d95', color: '#fff', padding: 24, borderRadius: 12, marginBottom: 32, display: 'flex', alignItems: 'center', gap: 16, boxShadow: '0 8px 25px rgba(76, 29, 149, 0.3)' }}>
                  <div style={{ background: '#7c3aed', padding: 12, borderRadius: 12 }}><Sparkles size={32} /></div>
                  <div>
                    <div style={{ fontSize: '0.875rem', fontWeight: 600, letterSpacing: '0.1em', opacity: 0.8, textTransform: 'uppercase', marginBottom: 4 }}>🧠 AI Clinical Recommendation</div>
                    <div style={{ fontSize: '1.5rem', fontWeight: 800, marginBottom: 4 }}>{aiRecommendation.action}</div>
                    <div style={{ opacity: 0.9 }}>Reasoning: {aiRecommendation.reason}</div>
                  </div>
                </div>
              )}

              <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) minmax(0,2fr)', gap: 32 }}>
                
                {/* Risk Score */}
                <div className={`card ${results.riskAssessment?.score === 'CRITICAL' ? 'pulse-red-bg' : ''}`} style={{ textAlign: 'center', padding: '40px 20px', background: results.riskAssessment?.score === 'HIGH' || results.riskAssessment?.score === 'CRITICAL' ? '#fef2f2' : results.riskAssessment?.score === 'MEDIUM' ? '#fffbeb' : '#f0fdf4', border: `1px solid ${results.riskAssessment?.score === 'HIGH' || results.riskAssessment?.score === 'CRITICAL' ? '#fca5a5' : results.riskAssessment?.score === 'MEDIUM' ? '#fcd34d' : '#86efac'}` }}>
                  <div style={{ fontSize: '0.875rem', fontWeight: 700, letterSpacing: '0.1em', color: 'var(--text-secondary)', marginBottom: 12, textTransform: 'uppercase' }}>Computed Risk Score</div>
                  <div className={results.riskAssessment?.score === 'CRITICAL' ? 'pulse-text' : ''} style={{ fontSize: '4rem', fontWeight: 800, color: results.riskAssessment?.score === 'HIGH' || results.riskAssessment?.score === 'CRITICAL' ? '#dc2626' : results.riskAssessment?.score === 'MEDIUM' ? '#d97706' : '#16a34a', lineHeight: 1 }}>
                    {results.riskAssessment?.score || 'LOW'}
                  </div>
                  <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', marginTop: 24, fontWeight: 500 }}>
                    {isLiveMonitorActive ? 'Real-time engine constantly computing risk vectors.' : (results.riskAssessment?.reasons?.[0] || 'Safeguards active. No immediate risk determined by standard parameters.')}
                  </p>
                </div>

                {/* Alerts & Gaps */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
                  <div className="card" style={{ border: (isLiveMonitorActive ? liveAlerts : results.criticalAlerts)?.length > 0 ? '1px solid rgba(239,68,68,0.4)' : '1px solid var(--border)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
                      <div style={{ padding: 8, background: 'rgba(239, 68, 68, 0.1)', borderRadius: 8, color: '#ef4444' }}><AlertCircle size={20}/></div>
                      <h3 style={{ fontSize: '1.25rem', fontWeight: 600, color: (isLiveMonitorActive ? liveAlerts : results.criticalAlerts)?.length > 0 ? '#991b1b' : 'inherit' }}>
                        {isLiveMonitorActive ? 'Live Medical Alerts' : 'Critical Medical Alerts'}
                      </h3>
                    </div>
                    {isLiveMonitorActive ? (
                      liveAlerts.length > 0 ? liveAlerts.map((alert, idx) => (
                        <div key={idx} className={alert.level === 'critical' ? 'pulse-red-bg' : ''} style={{ background: '#fef2f2', padding: 16, borderRadius: 8, borderLeft: `5px solid ${alert.level==='critical'?'#dc2626':'#ef4444'}`, marginBottom: 12 }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}><span style={{ fontWeight: 800, color: '#991b1b' }}>{alert.level==='critical'?'[URGENT]':''} {alert.title}</span><span style={{ color: '#ef4444', fontWeight: 800 }}>{alert.dataPoint}</span></div>
                          <div style={{ fontSize: '0.875rem', color: '#7f1d1d' }}>{alert.explanation}</div>
                        </div>
                      )) : <div style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>No live limit thresholds crossed yet. Stable.</div>
                    ) : (
                      results.criticalAlerts?.length > 0 ? results.criticalAlerts.map((alert, idx) => (
                        <div key={idx} style={{ background: '#fef2f2', padding: 16, borderRadius: 8, borderLeft: '4px solid #ef4444', marginBottom: 12 }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}><span style={{ fontWeight: 700, color: '#991b1b' }}>{alert.title}</span><span style={{ color: '#ef4444', fontWeight: 800 }}>{alert.dataPoint}</span></div>
                          <div style={{ fontSize: '0.875rem', color: '#7f1d1d' }}>{alert.explanation}</div>
                        </div>
                      )) : (
                        <div style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>No critical static breaches detected from upload.</div>
                      )
                    )}
                  </div>

                  {/* MISSING REPORTS & PENDING ACTIONS */}
                  <div className="card" style={{ border: '1px solid rgba(245,158,11,0.3)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
                      <div style={{ padding: 8, background: 'rgba(245, 158, 11, 0.1)', borderRadius: 8, color: '#d97706' }}><XOctagon size={20}/></div>
                      <h3 style={{ fontSize: '1.25rem', fontWeight: 600 }}>Missed Actions & Missing Data</h3>
                    </div>
                    
                    {/* Live missing tests */}
                    {isLiveMonitorActive && missingTests.map((test, idx) => (
                      <div key={'m_'+idx} style={{ background: '#fffbeb', padding: 16, borderRadius: 8, border: '1px solid #fde68a', marginBottom: 12, display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                        <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#d97706', flexShrink: 0, marginTop: 6 }} />
                        <div>
                          <div style={{ fontWeight: 600, color: '#92400e', marginBottom: 4 }}>🟠 WARNING: Missing Test Report</div>
                          <div style={{ fontSize: '0.875rem', color: '#b45309' }}>{test}. Diagnostic confidence lowered.</div>
                        </div>
                      </div>
                    ))}

                    {/* Static missed actions */}
                    {results.missedActions?.map((action, idx) => (
                      <div key={idx} style={{ background: '#fffbeb', padding: 16, borderRadius: 8, border: '1px solid #fde68a', marginBottom: 12, display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                        <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#d97706', flexShrink: 0, marginTop: 6 }} />
                        <div>
                          <div style={{ fontWeight: 600, color: '#92400e', marginBottom: 4 }}>{action.task}</div>
                          <div style={{ fontSize: '0.875rem', color: '#b45309' }}>Reason: {action.reason}</div>
                        </div>
                      </div>
                    ))}
                    
                    {(!isLiveMonitorActive || missingTests.length === 0) && results.missedActions?.length === 0 && (
                      <div style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>No incomplete protocols detected.</div>
                    )}
                  </div>
                </div>

              </div>
            </motion.div>
          )}

          {/* TAB 3: TRENDS & ANALYTICS */}
          {activeTab === 'trends' && results && (
            <motion.div key="tab3" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}>
               <h1 style={{ fontSize: '2rem', fontWeight: 700, color: '#0f172a', marginBottom: 40 }}>Clinical Trends & Analytics</h1>
               <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
                <div className="card">
                    <h3 style={{ fontSize: '1.25rem', fontWeight: 600, marginBottom: 20 }}>Oxygen Saturation (SpO2)</h3>
                    <div style={{ width: '100%', height: 250 }}>
                      <ResponsiveContainer>
                        <LineChart data={results.trends?.length > 0 ? results.trends : [
                          { time: 'T-3', oxygen: 98 }, { time: 'T-2', oxygen: 97 }, 
                          { time: 'T-1', oxygen: 98.5 }, { time: 'Current', oxygen: parseFloat(results.medicalData?.oxygenLevel) || 98 }
                        ]}>
                          <CartesianGrid strokeDasharray="3 3" opacity={0.1} />
                          <XAxis dataKey="time" hide={!isLiveMonitorActive} />
                          <YAxis domain={[80, 100]} />
                          <RechartsTooltip />
                          <Line type="monotone" dataKey="oxygen" stroke="#10b981" strokeWidth={3} dot={false} isAnimationActive={!isLiveMonitorActive} />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                </div>

                <div className="card">
                    <h3 style={{ fontSize: '1.25rem', fontWeight: 600, marginBottom: 20 }}>Blood Pressure (Systolic)</h3>
                    <div style={{ width: '100%', height: 250 }}>
                      <ResponsiveContainer>
                        <LineChart data={results.trends?.length > 0 ? results.trends : [
                          { time: 'T-3', bp: 120 }, { time: 'T-2', bp: 122 }, 
                          { time: 'T-1', bp: 118 }, { time: 'Current', bp: parseFloat(results.medicalData?.bloodPressure) || 120 }
                        ]}>
                          <CartesianGrid strokeDasharray="3 3" opacity={0.1} />
                          <XAxis dataKey="time" hide={!isLiveMonitorActive} />
                          <YAxis domain={[90, 180]} />
                          <RechartsTooltip />
                          <Line type="monotone" dataKey="bp" stroke="#ef4444" strokeWidth={3} dot={false} isAnimationActive={!isLiveMonitorActive} />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                </div>
               </div>
            </motion.div>
          )}

          {/* TAB 4: HANDOFF REPORT */}
          {activeTab === 'handoff' && results && (
            <motion.div key="tab4" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 40 }}>
                <h1 style={{ fontSize: '2rem', fontWeight: 700, color: '#0f172a' }}>Doctor Handoff Screen</h1>
                <button className="btn-primary" style={{ padding: '10px 20px' }} onClick={() => window.print()}>
                  <Download size={18} style={{ marginRight: 8 }}/> Download Handoff PDF
                </button>
              </div>
              
              {/* PRINTABLE CONTAINER MAKES ITS OWN CARD */}
              <div className="card" style={{ padding: 48, background: '#fff', maxWidth: 900, margin: '0 auto' }}>
                <div style={{ textAlign: 'center', borderBottom: '2px solid var(--border)', paddingBottom: 32, marginBottom: 32 }}>
                  <Stethoscope size={40} color="#3b82f6" style={{ margin: '0 auto 16px' }} />
                  <h2 style={{ fontSize: '2rem', fontWeight: 800 }}>Clinical Shift Handoff Report</h2>
                  <div style={{ fontSize: '1.125rem', color: 'var(--text-secondary)', marginTop: 8 }}>Confidential Medical Summary</div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 40, marginBottom: 40 }}>
                  <div>
                     <h4 style={{ fontSize: '1.125rem', fontWeight: 700, color: '#0f172a', borderBottom: '1px solid #e2e8f0', paddingBottom: 12, marginBottom: 16 }}>Patient Overview</h4>
                     <p style={{ marginBottom: 8 }}><strong>Name:</strong> {results.patientInfo?.name}</p>
                     <p style={{ marginBottom: 8 }}><strong>Age/Gender:</strong> {results.patientInfo?.age} / {results.patientInfo?.gender}</p>
                     <p><strong>Report Time:</strong> {results.patientInfo?.reportDate}</p>
                  </div>
                  <div>
                     <h4 style={{ fontSize: '1.125rem', fontWeight: 700, color: '#dc2626', borderBottom: '1px solid #fecaca', paddingBottom: 12, marginBottom: 16 }}>System Risk Assessment</h4>
                     <p style={{ marginBottom: 8 }}><strong>Computed Grade:</strong> {results.riskAssessment?.score}</p>
                     <p><strong>Primary Flags:</strong> {results.riskAssessment?.reasons?.join(', ') || 'N/A'}</p>
                  </div>
                </div>

                <h4 style={{ fontSize: '1.125rem', fontWeight: 700, color: '#8b5cf6', borderBottom: '1px solid #ddd6fe', paddingBottom: 12, marginBottom: 16 }}>
                  Smart AI Synthesis
                </h4>
                <div style={{ background: '#faf5ff', padding: 24, borderRadius: 12, border: '1px solid #e9d5ff', lineHeight: 1.8, fontSize: '1.125rem', color: '#4c1d95', marginBottom: 40 }}>
                  <Sparkles size={20} style={{ display: 'inline', marginRight: 12, verticalAlign: 'middle' }}/>
                  {results.aiSummary || 'Intelligent processing completed successfully.'}
                </div>

                {/* DOCTOR NOTES FOR HANDOFF */}
                <div style={{ marginBottom: 40 }} className="print-notes-section">
                  <h4 style={{ fontSize: '1.125rem', fontWeight: 700, color: '#0f172a', borderBottom: '1px solid #e2e8f0', paddingBottom: 12, marginBottom: 16 }}>Clinical Annotations</h4>
                  <div className="no-print" style={{ display: 'flex', gap: 12, marginBottom: 24 }}>
                    <input type="text" value={doctorNote} onChange={e=>setDoctorNote(e.target.value)} placeholder="Add a shift handoff note..." style={{ flex: 1, padding: 12, borderRadius: 8, border: '1px solid #cbd5e1' }} />
                    <button className="btn-primary" onClick={addDoctorNote}>Add Note</button>
                  </div>
                  
                  {results.doctorNotes?.length > 0 ? results.doctorNotes.map((n, i) => (
                    <div key={i} style={{ background: '#f8fafc', padding: 16, borderRadius: 8, borderLeft: '4px solid #3b82f6', marginBottom: 12 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8, fontSize: '0.85rem' }}>
                        <span style={{ fontWeight: 700, color: '#1e40af' }}>Dr. {n.doctor}</span>
                        <span style={{ color: '#64748b' }}>{new Date(n.timestamp).toLocaleString()}</span>
                      </div>
                      <p>{n.note}</p>
                    </div>
                  )) : (
                    <p style={{ color: '#94a3b8', fontStyle: 'italic' }}>No handoff annotations added.</p>
                  )}
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid var(--border)', paddingTop: 32, color: 'var(--text-secondary)' }}>
                  <div style={{ fontSize: '0.875rem' }}>Generated by MediShift AI Risk Infrastructure</div>
                  <div style={{ width: 200, height: 40, borderBottom: '1px solid #000', position: 'relative' }}>
                    <span style={{ position: 'absolute', bottom: -24, left: 0, fontSize: '0.875rem' }}>Attending Signature</span>
                  </div>
                </div>
              </div>
            </motion.div>
          )}

        </AnimatePresence>
      </main>
    </div>
  );
}
