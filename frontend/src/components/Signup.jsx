import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import api from '../services/api';

const initialState = { name: '', email: '', password: '', role: 'patient' };
const allowedRoles = new Set(['patient', 'doctor', 'admin']);

const getErrorMessage = (err) => {
  if (err?.response?.data?.message) return err.response.data.message;
  if (err?.code === 'ECONNABORTED') return 'The server took too long to respond. Please try again.';
  if (err?.request) return 'Cannot reach the API server. Please check your connection and try again.';
  return 'Signup failed. Please try again.';
};

const roleDescriptions = {
  patient: 'Book appointments and manage your health records.',
  doctor: 'Manage your patients, schedule, and clinical notes.',
  admin: 'Oversee the full system, users, and operations.',
};

export default function Signup() {
  const [form, setForm] = useState(initialState);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleChange = (e) => setForm({ ...form, [e.target.name]: e.target.value });

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await api.post('/auth/signup', {
        name: form.name.trim(),
        email: form.email.trim().toLowerCase(),
        password: form.password,
        role: allowedRoles.has(form.role) ? form.role : 'patient',
      });
      localStorage.setItem('hms_token', res.data.token);
      localStorage.setItem('hms_user', JSON.stringify(res.data.user));
      navigate('/dashboard');
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-root">
      {/* Brand Panel */}
      <div className="auth-brand">
        <div className="auth-brand-orb-1" />
        <div className="auth-brand-orb-2" />
        <div className="auth-brand-content">
          <Link to="/" className="auth-brand-logo">
            <div className="auth-brand-icon">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                <path d="M12 5v14M5 12h14"/>
              </svg>
            </div>
            MedFlow
          </Link>
          <div className="auth-brand-quote">
            Care starts with<br />
            <span className="highlight">the right tools.</span>
          </div>
          <div className="auth-brand-tagline">
            One platform for every role in your healthcare team — patients, doctors, and administrators.
          </div>
        </div>
        {/* Role preview cards */}
        <div className="auth-brand-footer">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {[
              { role: 'Patient', desc: 'Book & track appointments', color: '#8B5CF6' },
              { role: 'Doctor', desc: 'Manage patients & schedule', color: '#10B981' },
              { role: 'Admin', desc: 'Full system oversight', color: '#635BFF' },
            ].map(r => (
              <div
                key={r.role}
                style={{
                  display: 'flex', alignItems: 'center', gap: 12,
                  background: 'rgba(255,255,255,0.04)',
                  border: '1px solid rgba(255,255,255,0.08)',
                  borderRadius: 12, padding: '10px 14px',
                  opacity: form.role === r.role.toLowerCase() ? 1 : 0.5,
                  transition: 'opacity 0.2s ease',
                }}
              >
                <div style={{ width: 8, height: 8, borderRadius: '50%', background: r.color, flexShrink: 0 }} />
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: '#D4D4D8' }}>{r.role}</div>
                  <div style={{ fontSize: 12, color: '#71717A' }}>{r.desc}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Form Panel */}
      <div className="auth-form-panel">
        <div className="auth-form-inner" style={{ animation: 'fade-up 0.5s ease both' }}>
          <div className="auth-form-title">Create your account</div>
          <div className="auth-form-sub">
            Already have an account? <Link to="/login">Sign in</Link>
          </div>

          {error && (
            <div className="alert alert-error" style={{ marginBottom: 20 }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" style={{ flexShrink: 0 }}>
                <circle cx="12" cy="12" r="10"/><path d="M12 8v4M12 16h.01"/>
              </svg>
              {error}
            </div>
          )}

          <form className="auth-stack" onSubmit={submit}>
            <div className="form-group">
              <label className="form-label">Full name</label>
              <input
                className="input"
                name="name"
                type="text"
                value={form.name}
                onChange={handleChange}
                required
                placeholder="Your full name"
                autoComplete="name"
              />
            </div>

            <div className="form-group">
              <label className="form-label">Email address</label>
              <input
                className="input"
                name="email"
                type="email"
                value={form.email}
                onChange={handleChange}
                required
                placeholder="you@example.com"
                autoComplete="email"
              />
            </div>

            <div className="form-group">
              <label className="form-label">Password</label>
              <input
                className="input"
                name="password"
                type="password"
                value={form.password}
                onChange={handleChange}
                required
                minLength={6}
                placeholder="Min. 6 characters"
                autoComplete="new-password"
              />
            </div>

            <div className="form-group">
              <label className="form-label">Your role</label>
              <select className="select" name="role" value={form.role} onChange={handleChange}>
                <option value="patient">Patient</option>
                <option value="doctor">Doctor</option>
                <option value="admin">Admin</option>
              </select>
              {form.role && (
                <div style={{ fontSize: 12, color: 'var(--text-subtle)', marginTop: 4 }}>
                  {roleDescriptions[form.role]}
                </div>
              )}
            </div>

            <button
              className="btn btn-primary btn-full"
              type="submit"
              disabled={loading}
              style={{ height: 48, fontSize: 15, marginTop: 4, borderRadius: 12 }}
            >
              {loading ? (
                <>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" style={{ animation: 'spin 0.8s linear infinite' }}>
                    <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
                  </svg>
                  Creating account...
                </>
              ) : 'Create account'}
            </button>
          </form>

          <div style={{ fontSize: 12, color: 'var(--text-subtle)', textAlign: 'center', marginTop: 16 }}>
            By creating an account, you agree to our Terms of Service and Privacy Policy.
          </div>
        </div>
      </div>
    </div>
  );
}
