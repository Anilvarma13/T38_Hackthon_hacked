import React, { useState } from 'react';
import { Activity, Lock, User } from 'lucide-react';
import { motion } from 'framer-motion';

export default function Login({ onLoginComplete }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const res = await fetch('http://localhost:4000/api/v1/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
      });
      const data = await res.json();
      if (res.ok) {
        localStorage.setItem('auth_token', data.token);
        localStorage.setItem('auth_user', JSON.stringify(data.user));
        onLoginComplete(data.user);
      } else {
        setError(data.error || 'Login failed');
      }
    } catch (err) {
      setError('Connection refused. Ensure backend is running.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg-gradient)', padding: 20 }}>
      <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="card" style={{ maxWidth: 400, width: '100%', padding: 40, textAlign: 'center', boxShadow: 'var(--shadow-xl)' }}>
        
        <div style={{ background: 'var(--brand-gradient)', color: '#fff', width: 64, height: 64, borderRadius: 16, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 24px' }}>
          <Activity size={32} />
        </div>
        
        <h1 style={{ fontSize: '1.75rem', fontWeight: 800, marginBottom: 8, color: '#0f172a' }}>MediShift AI</h1>
        <p style={{ color: 'var(--text-secondary)', marginBottom: 32 }}>Secure Clinical Handoff Portal</p>

        {error && (
          <div style={{ background: '#fef2f2', color: '#dc2626', padding: '12px', borderRadius: 8, marginBottom: 24, fontSize: '0.875rem', fontWeight: 500, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
            <Lock size={16} /> {error}
          </div>
        )}

        <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ position: 'relative' }}>
            <User size={20} style={{ position: 'absolute', left: 16, top: 14, color: '#94a3b8' }} />
            <input 
              type="text" 
              placeholder="Username" 
              value={username}
              onChange={e => setUsername(e.target.value)}
              style={{ width: '100%', padding: '14px 16px 14px 48px', border: '1px solid #e2e8f0', borderRadius: 8, outline: 'none', background: '#f8fafc' }}
              disabled={loading}
              required
            />
          </div>
          
          <div style={{ position: 'relative' }}>
            <Lock size={20} style={{ position: 'absolute', left: 16, top: 14, color: '#94a3b8' }} />
            <input 
              type="password" 
              placeholder="Password" 
              value={password}
              onChange={e => setPassword(e.target.value)}
              style={{ width: '100%', padding: '14px 16px 14px 48px', border: '1px solid #e2e8f0', borderRadius: 8, outline: 'none', background: '#f8fafc' }}
              disabled={loading}
              required
            />
          </div>

          <button type="submit" className="btn-primary" style={{ width: '100%', marginTop: 8 }} disabled={loading}>
            {loading ? 'Authenticating...' : 'Secure Login'}
          </button>
        </form>
        
        <div style={{ marginTop: 24, fontSize: '0.75rem', color: '#94a3b8' }}>
          Authorized hospital personnel only. Activity is monitored.
        </div>
      </motion.div>
    </div>
  );
}
