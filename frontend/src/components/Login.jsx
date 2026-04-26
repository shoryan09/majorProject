import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import api from '../services/api';

const initialState = { email: '', password: '' };

const getErrorMessage = (err) => {
  if (err?.response?.data?.message) return err.response.data.message;
  if (err?.code === 'ECONNABORTED') return 'The server took too long to respond. Please try again.';
  if (err?.request) return 'Cannot reach the API server. Start the backend on port 5000 and try again.';
  return 'Login failed. Please check your credentials.';
};

export default function Login() {
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
      const res = await api.post('/auth/login', {
        email: form.email.trim().toLowerCase(),
        password: form.password,
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
            The OS for<br />
            <span className="highlight">modern healthcare.</span>
          </div>
          <div className="auth-brand-tagline">
            Appointments, patients, and care workflows — unified in one elegant workspace.
          </div>
        </div>
        <div className="auth-brand-footer">
          <div className="auth-testimonial">
            <div className="auth-testimonial-text">
              "MedFlow cut our appointment admin time by 60%. Our doctors spend more time with patients and less time on paperwork."
            </div>
            <div className="auth-testimonial-author">
              <div className="auth-avatar">DR</div>
              <div>
                <div className="auth-author-name">Dr. Rebecca Chen</div>
                <div className="auth-author-role">Chief of Internal Medicine</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Form Panel */}
      <div className="auth-form-panel">
        <div className="auth-form-inner" style={{ animation: 'fade-up 0.5s ease both' }}>
          <div className="auth-form-title">Welcome back</div>
          <div className="auth-form-sub">
            Don't have an account? <Link to="/signup">Sign up free</Link>
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
                placeholder="Enter your password"
                autoComplete="current-password"
              />
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
                  Signing in...
                </>
              ) : 'Sign in to MedFlow'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
