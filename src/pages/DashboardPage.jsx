import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Database, Search, ChevronRight, Activity, Clock, Shield } from 'lucide-react';
import { AppContext } from '../App';
import './DashboardPage.css';

export default function DashboardPage() {
  const navigate = useNavigate();
  const { setPatientData } = React.useContext(AppContext);
  const [patients, setPatients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  useEffect(() => {
    fetch('http://localhost:5000/api/patients')
      .then(res => res.json())
      .then(data => {
        setPatients(data);
        setLoading(false);
      })
      .catch(err => {
        console.error(err);
        setLoading(false);
      });
  }, []);

  const openPatient = async (id) => {
    try {
      const res = await fetch(`http://localhost:5000/api/patients/${id}`);
      const data = await res.json();
      setPatientData(data);
      navigate('/patient');
    } catch (error) {
      console.error(error);
    }
  };

  const filtered = patients.filter(p => p.name.toLowerCase().includes(search.toLowerCase()) || p.patientId.toLowerCase().includes(search.toLowerCase()));

  return (
    <main className="dashboard-page page">
      <div className="page-header animate-fadeUp">
        <h1 className="page-title">Saved Patient Records</h1>
        <p className="page-subtitle">Access previously processed clinical handoff intelligence</p>
      </div>

      <div className="dash-toolbar animate-fadeUp stagger-1">
        <div className="search-box">
          <Search size={16} />
          <input 
            type="text" 
            placeholder="Search by name or ID..." 
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        <button className="btn btn-primary" onClick={() => navigate('/')}>
          + New PDF Upload
        </button>
      </div>

      <div className="records-grid animate-fadeUp stagger-2">
        {loading ? (
          <div className="dash-loading">Loading saved records...</div>
        ) : filtered.length === 0 ? (
          <div className="dash-empty">
            <Database size={40} className="empty-icon" />
            <p>No processed patient records found.</p>
          </div>
        ) : (
          filtered.map(p => (
            <div key={p.id} className="record-card card" onClick={() => openPatient(p.id)}>
              <div className="rc-top">
                <div className="rc-name">{p.name}</div>
                <ChevronRight size={18} className="rc-chevron" />
              </div>
              <div className="rc-meta">
                <span>{p.age} yr</span>
                <span className="dot-sep">·</span>
                <span>{p.ward}</span>
              </div>
              <div className="rc-footer">
                <div className="rc-id">
                  <Activity size={12} />
                  {p.patientId}
                </div>
                <div className="rc-date">
                  <Clock size={12} />
                  {new Date(p.createdAt).toLocaleDateString()}
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </main>
  );
}
