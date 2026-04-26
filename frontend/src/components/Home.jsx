import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';

const features = [
  {
    title: 'Smart Appointment Booking',
    desc: 'Patients book visits in seconds. Doctors see their queue in real-time. No double-bookings, no friction.',
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
        <rect x="3" y="4" width="18" height="17" rx="2"/><path d="M8 2v4M16 2v4M3 10h18"/>
      </svg>
    ),
  },
  {
    title: 'Unified Patient Directory',
    desc: 'Complete health profiles with blood type, emergency contacts, history, and notes — all in one place.',
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
        <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M19 8v6M22 11h-6"/>
      </svg>
    ),
  },
  {
    title: 'Role-Based Access Control',
    desc: 'Patients, doctors, and admins each see exactly what they need — nothing more, nothing less.',
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z"/><path d="m9 12 2 2 4-4"/>
      </svg>
    ),
  },
  {
    title: 'Live Status Tracking',
    desc: 'Monitor appointment statuses — pending, confirmed, completed — with instant visibility across all roles.',
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
        <path d="M22 12h-4l-3 9L9 3l-3 9H2"/>
      </svg>
    ),
  },
  {
    title: 'Profile Completion Engine',
    desc: 'Track how complete each profile is and prompt users to fill gaps that matter for care quality.',
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
        <path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/>
      </svg>
    ),
  },
  {
    title: 'Secure Authentication',
    desc: 'JWT-based auth with token expiry, role validation, and server-side access enforcement on every request.',
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
        <rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>
      </svg>
    ),
  },
];

const steps = [
  { num: '01', title: 'Create your account', desc: 'Sign up as a patient, doctor, or admin. Your role shapes your entire experience from day one.' },
  { num: '02', title: 'Complete your profile', desc: 'Fill in your clinical details, specializations, or health notes. The system adapts to what you need.' },
  { num: '03', title: 'Start managing care', desc: 'Book appointments, add patients, view records. Everything in one focused dashboard.' },
];

export default function Home() {
  const [scrolled, setScrolled] = useState(false);
  const [countersStarted, setCountersStarted] = useState(false);
  const statsRef = useRef(null);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => {
    if (!statsRef.current) return;
    const obs = new IntersectionObserver(
      ([e]) => { if (e.isIntersecting) { setCountersStarted(true); obs.disconnect(); } },
      { threshold: 0.3 }
    );
    obs.observe(statsRef.current);
    return () => obs.disconnect();
  }, []);

  return (
    <div>
      {/* NAV */}
      <nav className={`home-nav${scrolled ? ' scrolled' : ''}`}>
        <div className="nav-inner">
          <Link to="/" className="nav-brand">
            <div className="nav-brand-icon">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                <path d="M12 5v14M5 12h14"/>
              </svg>
            </div>
            MedFlow
          </Link>
          <div className="nav-links">
            <a href="#features" className="nav-link">Features</a>
            <a href="#how" className="nav-link">How it works</a>
            <Link to="/login" className="nav-link">Log in</Link>
          </div>
          <div className="nav-actions">
            <Link
              to="/signup"
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 8,
                padding: '0 18px', height: 38,
                background: 'linear-gradient(135deg,#635BFF,#8B5CF6)',
                color: 'white', fontSize: 14, fontWeight: 700,
                borderRadius: 10, letterSpacing: '-0.01em',
                transition: 'all 0.18s', boxShadow: '0 0 20px rgba(99,91,255,0.4)',
              }}
            >
              Get started free
            </Link>
          </div>
        </div>
      </nav>

      {/* HERO */}
      <section className="hero-section">
        <div className="hero-grid" />
        <div className="hero-orbs">
          <div className="orb orb-1" />
          <div className="orb orb-2" />
          <div className="orb orb-3" />
        </div>

        <div className="hero-inner">
          <div className="hero-pill">
            <span className="hero-pill-dot" />
            Now in open access · No credit card required
          </div>
          <h1 className="hero-headline">
            Healthcare management,<br />
            <span className="accent">reimagined.</span>
          </h1>
          <p className="hero-subtitle">
            MedFlow gives hospitals, clinics, and care teams a single, elegant workspace — appointments, patient records, and role-based workflows, all unified.
          </p>
          <div className="hero-actions">
            <Link to="/signup" className="hero-glow-btn">
              Start for free
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                <path d="M5 12h14M12 5l7 7-7 7"/>
              </svg>
            </Link>
            <Link to="/login" className="hero-ghost-btn">
              Sign in to dashboard
            </Link>
          </div>

          {/* Dashboard frame mockup */}
          <div className="hero-visual">
            <div className="float-badge float-badge-1">
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#10B981', display: 'inline-block', flexShrink: 0 }} />
              12 appointments today
            </div>
            <div className="hero-dashboard-frame">
              <div className="frame-bar">
                <div className="frame-dot" /><div className="frame-dot" /><div className="frame-dot" />
              </div>
              <div className="frame-content">
                <div className="frame-sidebar">
                  <div className="frame-nav-item active" />
                  <div className="frame-nav-item" style={{ animationDelay: '0.2s' }} />
                  <div className="frame-nav-item" style={{ animationDelay: '0.4s' }} />
                  <div className="frame-nav-item" style={{ animationDelay: '0.6s' }} />
                </div>
                <div className="frame-main">
                  <div className="frame-stat-row">
                    <div className="frame-stat primary-glow" />
                    <div className="frame-stat" style={{ animationDelay: '0.3s' }} />
                    <div className="frame-stat" style={{ animationDelay: '0.5s' }} />
                  </div>
                  <div className="frame-row" style={{ animationDelay: '0.2s' }} />
                  <div className="frame-row" style={{ animationDelay: '0.35s' }} />
                  <div className="frame-row" style={{ animationDelay: '0.5s' }} />
                </div>
              </div>
            </div>
            <div className="float-badge float-badge-2">
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#635BFF', display: 'inline-block', flexShrink: 0 }} />
              Profile 92% complete
            </div>
          </div>
        </div>
      </section>

      {/* STATS BAR */}
      <div ref={statsRef} className="stats-bar">
        <div className="stats-bar-inner">
          {[
            { value: countersStarted ? '10K+' : '0', label: 'Active patients' },
            { value: countersStarted ? '500+' : '0', label: 'Healthcare providers' },
            { value: countersStarted ? '99.9%' : '0%', label: 'Uptime SLA' },
            { value: countersStarted ? '<50ms' : '—', label: 'Avg response time' },
          ].map(s => (
            <div key={s.label} className="stat-item">
              <div className="stat-value" style={{ animation: countersStarted ? 'counter-in 0.6s ease both' : 'none' }}>{s.value}</div>
              <div className="stat-label">{s.label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* FEATURES */}
      <section id="features" className="section" style={{ background: 'var(--bg)' }}>
        <div className="section-inner">
          <div className="section-tag">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="12" r="5"/></svg>
            Platform features
          </div>
          <h2 className="section-headline">Everything a modern clinic needs</h2>
          <p className="section-sub">Built around how care teams actually work — not how software companies think they work.</p>
          <div className="features-grid">
            {features.map((f, i) => (
              <div className="feature-card" key={f.title} style={{ animationDelay: `${i * 0.08}s` }}>
                <div className="feature-icon">{f.icon}</div>
                <div className="feature-title">{f.title}</div>
                <div className="feature-desc">{f.desc}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* HOW IT WORKS */}
      <section id="how" className="how-section">
        <div className="section-inner">
          <div className="section-tag">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="12" r="5"/></svg>
            How it works
          </div>
          <h2 className="section-headline">Up and running in minutes</h2>
          <p className="section-sub">No onboarding calls. No setup fees. No lengthy configuration.</p>
          <div className="steps-grid">
            {steps.map(s => (
              <div className="step" key={s.num}>
                <div className="step-num">{s.num}</div>
                <div className="step-title">{s.title}</div>
                <div className="step-desc">{s.desc}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="cta-section">
        <div className="cta-orb" />
        <div className="cta-inner">
          <h2 className="cta-headline">Ready to transform your practice?</h2>
          <p className="cta-sub">Join thousands of healthcare professionals who manage their workflow with MedFlow.</p>
          <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
            <Link to="/signup" className="hero-glow-btn">
              Create free account
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                <path d="M5 12h14M12 5l7 7-7 7"/>
              </svg>
            </Link>
            <Link to="/login" className="hero-ghost-btn">
              Sign in
            </Link>
          </div>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="home-footer">
        <div className="home-footer-inner">
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div className="nav-brand-icon" style={{ width: 24, height: 24, borderRadius: 6 }}>
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                <path d="M12 5v14M5 12h14"/>
              </svg>
            </div>
            <span style={{ fontSize: 14, fontWeight: 700, color: '#52525B' }}>MedFlow</span>
          </div>
          <div className="footer-copy">© {new Date().getFullYear()} MedFlow. Built for modern healthcare.</div>
          <div style={{ display: 'flex', gap: 20 }}>
            <Link to="/login" style={{ fontSize: 13, color: '#52525B' }}>Log in</Link>
            <Link to="/signup" style={{ fontSize: 13, color: '#52525B' }}>Sign up</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
