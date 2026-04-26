import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';

/* ── helpers ── */
function getStoredUser() { return JSON.parse(localStorage.getItem('hms_user') || '{}'); }
function getErrMsg(err, fallback) {
  if (err?.response?.data?.message) return err.response.data.message;
  if (err?.request) return 'Cannot reach the API server.';
  return fallback;
}

/* ── role config ── */
const ROLE_CFG = {
  patient: {
    cls: 'role-patient',
    label: 'Patient',
    tagline: 'Your health, your records.',
    fields: [['phone','Phone'],['age','Age'],['bloodGroup','Blood Group'],['emergencyContact','Emergency Contact'],['city','City'],['bio','Health Notes']],
    infoCards: (user, appts) => [
      { label:'Appointments', value: appts.length, icon:'🗓️', color:'#0D9488', bg:'rgba(13,148,136,0.1)' },
      { label:'Blood Group',  value: user.profile?.bloodGroup || '—', icon:'🩸', color:'#EF4444', bg:'rgba(239,68,68,0.1)' },
      { label:'City',         value: user.profile?.city || '—', icon:'📍', color:'#F59E0B', bg:'rgba(245,158,11,0.1)' },
    ],
  },
  doctor: {
    cls: 'role-doctor',
    label: 'Doctor',
    tagline: 'Caring for patients, one visit at a time.',
    fields: [['phone','Phone'],['specialization','Specialization'],['licenseNumber','License #'],['department','Department'],['availability','Availability'],['bio','Clinical Bio']],
    infoCards: (user, appts) => [
      { label:'Appointments',     value: appts.length, icon:'📋', color:'#7C3AED', bg:'rgba(124,58,237,0.1)' },
      { label:'Specialization',   value: user.profile?.specialization || '—', icon:'🩺', color:'#7C3AED', bg:'rgba(124,58,237,0.1)' },
      { label:'Department',       value: user.profile?.department || '—', icon:'🏥', color:'#0891B2', bg:'rgba(8,145,178,0.1)' },
    ],
  },
  admin: {
    cls: 'role-admin',
    label: 'Admin',
    tagline: 'Managing the system with precision.',
    fields: [['phone','Phone'],['adminTitle','Title'],['department','Department'],['organization','Organization'],['city','City'],['bio','Notes']],
    infoCards: (user, appts) => [
      { label:'Title',        value: user.profile?.adminTitle || '—', icon:'👔', color:'#D97706', bg:'rgba(217,119,6,0.1)' },
      { label:'Organization', value: user.profile?.organization || '—', icon:'🏢', color:'#D97706', bg:'rgba(217,119,6,0.1)' },
      { label:'Department',   value: user.profile?.department || '—', icon:'📁', color:'#059669', bg:'rgba(5,150,105,0.1)' },
    ],
  },
};

const STATUS_CLR = {
  pending:   { dot:'#F59E0B', bg:'#FEF3C7', color:'#92400E' },
  confirmed: { dot:'#7C3AED', bg:'#EDE9FE', color:'#5B21B6' },
  completed: { dot:'#10B981', bg:'#D1FAE5', color:'#065F46' },
  cancelled: { dot:'#EF4444', bg:'#FEE2E2', color:'#991B1B' },
};

/* ── icons ── */
const Ico = ({ d, extra, size=16 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    {extra}{d && <path d={d}/>}
  </svg>
);
const IcoHome    = () => <Ico extra={<><path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></>}/>;
const IcoUser    = () => <Ico extra={<><circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/></>}/>;
const IcoPlus    = () => <Ico d="M12 5v14M5 12h14"/>;
const IcoLogout  = () => <Ico d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9"/>;
const IcoCalendar= () => <Ico extra={<><rect x="3" y="4" width="18" height="17" rx="2"/><path d="M8 2v4M16 2v4M3 10h18"/></>}/>;
const IcoCheck   = () => <Ico d="M20 6 9 17l-5-5"/>;
const IcoAlert   = () => <Ico extra={<><circle cx="12" cy="12" r="10"/><path d="M12 8v4M12 16h.01"/></>}/>;
const IcoSpin    = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" style={{animation:'spin 0.7s linear infinite'}}><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>;
const IcoEdit    = () => <Ico extra={<><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></>}/>;
const IcoChevron = () => <Ico d="m9 18 6-6-6-6" size={12}/>;

function StatusBadge({ status }) {
  const s = (status||'pending').toLowerCase();
  const c = STATUS_CLR[s] || STATUS_CLR.pending;
  return (
    <span style={{display:'inline-flex',alignItems:'center',gap:5,padding:'3px 9px',borderRadius:999,fontSize:11,fontWeight:600,background:c.bg,color:c.color}}>
      <span style={{width:5,height:5,borderRadius:'50%',background:c.dot}}/>
      {s}
    </span>
  );
}

/* ── completion ring SVG ── */
function CompletionRing({ pct, size=108 }) {
  const r = (size - 12) / 2;
  const circ = 2 * Math.PI * r;
  const offset = circ - (pct / 100) * circ;
  return (
    <svg width={size} height={size} style={{position:'absolute',inset:-6,transform:'rotate(-90deg)'}}>
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="rgba(255,255,255,0.15)" strokeWidth="4"/>
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="white" strokeWidth="4"
        strokeLinecap="round" strokeDasharray={circ} strokeDashoffset={offset}
        style={{transition:'stroke-dashoffset 1s cubic-bezier(0,0,0.2,1)'}}/>
    </svg>
  );
}

/* ── sidebar ── */
function Sidebar({ role, cfg, onLogout }) {
  const navigate = useNavigate();
  return (
    <aside className={`dash2-sidebar ${cfg.cls}`}>
      <div className="dash2-logo">
        <div className="dash2-logo-icon"><IcoPlus/></div>
        MedFlow
      </div>
      <nav className="dash2-nav">
        <div className="dash2-nav-section">Workspace</div>
        <button className="dash2-nav-btn" onClick={() => navigate('/dashboard')}><IcoHome/>Overview</button>
        <div className="dash2-nav-section" style={{marginTop:8}}>Account</div>
        <button className="dash2-nav-btn active"><IcoUser/>Profile</button>
        <button className="dash2-nav-btn" onClick={onLogout}><IcoLogout/>Sign out</button>
      </nav>
    </aside>
  );
}

/* ════════════════════════════
   PROFILE PAGE
════════════════════════════ */
export default function Profile() {
  const storedUser = getStoredUser();
  const [user, setUser]         = useState(storedUser);
  const [appointments, setAppts]= useState([]);
  const [loading, setLoading]   = useState(true);
  const [saving, setSaving]     = useState(false);
  const [error, setError]       = useState('');
  const [success, setSuccess]   = useState('');
  const [form, setForm]         = useState({ name: storedUser.name||'', profile: storedUser.profile||{} });
  const navigate = useNavigate();

  const role = user.role || 'patient';
  const cfg  = ROLE_CFG[role] || ROLE_CFG.patient;

  /* fetch */
  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const [meRes, apRes] = await Promise.all([api.get('/me'), api.get('/appointments')]);
        const u = meRes.data.user;
        setUser(u);
        setForm({ name: u.name||'', profile: u.profile||{} });
        localStorage.setItem('hms_user', JSON.stringify(u));
        setAppts(apRes.data);
      } catch(err) { setError(getErrMsg(err,'Could not load profile.')); }
      finally { setLoading(false); }
    })();
  }, []);

  useEffect(() => {
    if (!success) return;
    const t = setTimeout(() => setSuccess(''), 4000);
    return () => clearTimeout(t);
  }, [success]);

  const logout = () => { localStorage.removeItem('hms_token'); localStorage.removeItem('hms_user'); navigate('/login'); };

  /* profile completion */
  const profilePct = useMemo(() => {
    const done = cfg.fields.filter(([k]) => String(form.profile?.[k]||'').trim()).length;
    return Math.round(((done + (form.name ? 1 : 0)) / (cfg.fields.length + 1)) * 100);
  }, [cfg.fields, form]);

  /* save */
  const saveProfile = async (e) => {
    e.preventDefault(); setError(''); setSuccess(''); setSaving(true);
    try {
      const res = await api.put('/profile', form);
      const u = res.data.user;
      setUser(u);
      setForm({ name: u.name||'', profile: u.profile||{} });
      localStorage.setItem('hms_user', JSON.stringify(u));
      setSuccess('Profile saved successfully!');
    } catch(err) { setError(getErrMsg(err,'Could not save profile.')); }
    finally { setSaving(false); }
  };

  const sortedAppts = useMemo(() =>
    [...appointments].sort((a,b) => new Date(`${a.date}T${a.time}`) - new Date(`${b.date}T${b.time}`)),
    [appointments]
  );

  const infoCards = cfg.infoCards(user, appointments);

  return (
    <div className={`${cfg.cls}`} style={{minHeight:'100vh',background:'var(--bg)'}}>
      <Sidebar role={role} cfg={cfg} onLogout={logout}/>

      <div className="profile-root">
        {/* ─ sticky header ─ */}
        <header className="dash2-header" style={{position:'sticky',top:0,zIndex:40}}>
          <div className="dash2-breadcrumb">
            <button onClick={()=>navigate('/dashboard')} style={{background:'none',border:'none',cursor:'pointer',color:'var(--text-muted)',display:'flex',alignItems:'center',gap:4,fontSize:13}}>
              MedFlow
            </button>
            <IcoChevron/> <strong>Profile</strong>
          </div>
          <div className="dash2-header-actions">
            {error   && <div className="dash2-alert dash2-alert-err" style={{maxWidth:260}}><IcoAlert/><span style={{overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{error}</span></div>}
            {success && <div className="dash2-alert dash2-alert-ok"><IcoCheck/>{success}</div>}
            <div className="dash2-role-pill"><span className="dash2-role-dot"/>{role}</div>
            <button className="dash2-icon-btn" onClick={logout} title="Sign out"><IcoLogout/></button>
          </div>
        </header>

        {/* ─ hero ─ */}
        <div className="profile-hero">
          <div className="profile-hero-grid"/>
          <div className="profile-hero-orb profile-hero-orb1"/>
          <div className="profile-hero-orb profile-hero-orb2"/>
          <div className="profile-hero-inner">
            <div className="profile-avatar-wrap">
              <div className="profile-avatar">
                {loading ? '?' : (user.name||'U')[0].toUpperCase()}
              </div>
              <CompletionRing pct={profilePct}/>
              <div className="profile-role-badge">{cfg.label}</div>
              <div className="profile-pct-text">{profilePct}% complete</div>
            </div>
            <div className="profile-hero-info">
              <div className="profile-hero-name">{loading ? '...' : user.name || 'User'}</div>
              <div className="profile-hero-email">{user.email || ''}</div>
              <div className="profile-hero-chips">
                <div className="profile-hero-chip"><IcoCalendar/>{appointments.length} appointments</div>
                {user.profile?.city && <div className="profile-hero-chip">📍 {user.profile.city}</div>}
                {user.profile?.phone && <div className="profile-hero-chip">📞 {user.profile.phone}</div>}
                {/* doctor extras */}
                {role === 'doctor' && user.profile?.specialization && <div className="profile-hero-chip">🩺 {user.profile.specialization}</div>}
                {/* admin extras */}
                {role === 'admin' && user.profile?.adminTitle && <div className="profile-hero-chip">👔 {user.profile.adminTitle}</div>}
              </div>
            </div>
          </div>
        </div>

        {/* ─ content ─ */}
        <div className="profile-content">

          {/* info cards — pull up over hero */}
          <div className="profile-info-grid">
            {infoCards.map((c, i) => (
              <div key={i} className="profile-info-card" style={{animationDelay:`${i*0.1}s`}}>
                <div className="profile-info-card-icon" style={{background:c.bg,color:c.color}}>
                  <span style={{fontSize:18}}>{c.icon}</span>
                </div>
                <div className="profile-info-card-val">{loading ? '—' : c.value}</div>
                <div className="profile-info-card-label">{c.label}</div>
              </div>
            ))}
          </div>

          {/* edit form */}
          <div className="profile-form-card">
            <div className="profile-form-head">
              <div>
                <div className="profile-form-title">Edit Profile</div>
                <div className="profile-form-sub">{cfg.tagline}</div>
              </div>
              <div style={{display:'flex',alignItems:'center',gap:8}}>
                <div style={{fontSize:12,color:'var(--text-muted)'}}>{profilePct}% complete</div>
                <div style={{width:80,height:4,background:'var(--surface-raised)',borderRadius:4,overflow:'hidden'}}>
                  <div style={{height:'100%',width:`${profilePct}%`,background:'linear-gradient(90deg,var(--role-accent,var(--primary)),var(--primary))',borderRadius:4,transition:'width 0.8s ease'}}/>
                </div>
              </div>
            </div>
            <div className="profile-form-body">
              <form onSubmit={saveProfile}>
                <div className="profile-form-grid">
                  {/* name */}
                  <div className="dash2-fg">
                    <label>Display Name</label>
                    <input className="dash2-inp" value={form.name} onChange={e=>setForm(p=>({...p,name:e.target.value}))} required placeholder="Your name"/>
                  </div>
                  {/* email (read-only) */}
                  <div className="dash2-fg">
                    <label>Email</label>
                    <input className="dash2-inp" value={user.email||''} disabled/>
                  </div>

                  {/* dynamic fields */}
                  {cfg.fields.map(([key, label]) => (
                    <div key={key} className={key === 'bio' ? 'pf-span2' : ''}>
                      <div className="dash2-fg">
                        <label>{label}</label>
                        {key === 'bio' ? (
                          <textarea
                            className="dash2-inp dash2-textarea"
                            value={form.profile?.[key]||''}
                            onChange={e=>setForm(p=>({...p,profile:{...p.profile,[key]:e.target.value}}))}
                            placeholder={`Your ${label.toLowerCase()}...`}
                          />
                        ) : (
                          <input
                            className="dash2-inp"
                            value={form.profile?.[key]||''}
                            onChange={e=>setForm(p=>({...p,profile:{...p.profile,[key]:e.target.value}}))}
                            placeholder={label}
                          />
                        )}
                      </div>
                    </div>
                  ))}

                  {/* save */}
                  <div className="pf-span2" style={{paddingTop:4}}>
                    <button type="submit" className="profile-save-btn" disabled={saving}>
                      {saving ? <><IcoSpin/>Saving...</> : <><IcoCheck/>Save Profile</>}
                    </button>
                  </div>
                </div>
              </form>
            </div>
          </div>

          {/* appointment history */}
          <div className="profile-activity-card">
            <div className="profile-form-head">
              <div>
                <div className="profile-form-title">Appointment History</div>
                <div className="profile-form-sub">{appointments.length} total records</div>
              </div>
              <div style={{color:'var(--role-accent,var(--primary))'}}><IcoCalendar/></div>
            </div>

            {loading ? (
              <div style={{padding:'20px 22px',display:'flex',flexDirection:'column',gap:12}}>
                {[1,2,3].map(i=>(
                  <div key={i} style={{height:64,borderRadius:'var(--r)',background:'var(--surface-raised)',animation:'shimmer 1.6s linear infinite',backgroundImage:'linear-gradient(90deg,var(--surface-raised) 0%,var(--border-strong) 50%,var(--surface-raised) 100%)',backgroundSize:'200% 100%'}}/>
                ))}
              </div>
            ) : sortedAppts.length > 0 ? (
              <div>
                {sortedAppts.slice(0,8).map((a, i) => {
                  const d = new Date(a.date+'T12:00');
                  return (
                    <div key={a.id} className="profile-appt-tile" style={{animationDelay:`${i*0.05}s`}}>
                      <div className="profile-appt-date">
                        <div className="profile-appt-day">{d.getDate()}</div>
                        <div className="profile-appt-mon">{d.toLocaleDateString('en-US',{month:'short'})}</div>
                      </div>
                      <div style={{flex:1,minWidth:0}}>
                        <div style={{fontSize:13,fontWeight:600,color:'var(--text)'}}>Dr. {a.doctorId}</div>
                        <div style={{fontSize:11,color:'var(--text-muted)',marginTop:2}}>{a.time} · {d.toLocaleDateString('en-US',{weekday:'long'})}</div>
                      </div>
                      <StatusBadge status={a.status}/>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div style={{textAlign:'center',padding:'48px 20px',color:'var(--text-muted)'}}>
                <div style={{fontSize:32,marginBottom:10,opacity:.4}}>📅</div>
                <div style={{fontSize:13}}>No appointments yet.</div>
              </div>
            )}
          </div>

          {/* role-specific section */}
          {role === 'patient' && user.profile?.bloodGroup && (
            <div className="profile-form-card">
              <div className="profile-form-head">
                <div className="profile-form-title">🩺 Health Summary</div>
              </div>
              <div className="profile-form-body">
                <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:16}}>
                  {[
                    ['Blood Group', user.profile?.bloodGroup || '—'],
                    ['Emergency Contact', user.profile?.emergencyContact || '—'],
                    ['City', user.profile?.city || '—'],
                  ].map(([l,v])=>(
                    <div key={l} style={{background:'var(--surface-raised)',borderRadius:'var(--r)',padding:'14px 16px'}}>
                      <div style={{fontSize:11,fontWeight:700,color:'var(--text-muted)',textTransform:'uppercase',letterSpacing:'0.05em',marginBottom:6}}>{l}</div>
                      <div style={{fontSize:15,fontWeight:700,color:'var(--text)'}}>{v}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {role === 'doctor' && (
            <div className="profile-form-card">
              <div className="profile-form-head">
                <div className="profile-form-title">🏥 Clinical Details</div>
              </div>
              <div className="profile-form-body">
                <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:16}}>
                  {[
                    ['License #', user.profile?.licenseNumber || '—'],
                    ['Department', user.profile?.department || '—'],
                    ['Availability', user.profile?.availability || '—'],
                  ].map(([l,v])=>(
                    <div key={l} style={{background:'var(--surface-raised)',borderRadius:'var(--r)',padding:'14px 16px'}}>
                      <div style={{fontSize:11,fontWeight:700,color:'var(--text-muted)',textTransform:'uppercase',letterSpacing:'0.05em',marginBottom:6}}>{l}</div>
                      <div style={{fontSize:15,fontWeight:700,color:'var(--text)'}}>{v}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {role === 'admin' && (
            <div className="profile-form-card">
              <div className="profile-form-head">
                <div className="profile-form-title">🏢 Organization Details</div>
              </div>
              <div className="profile-form-body">
                <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:16}}>
                  {[
                    ['Organization', user.profile?.organization || '—'],
                    ['Department', user.profile?.department || '—'],
                    ['City', user.profile?.city || '—'],
                  ].map(([l,v])=>(
                    <div key={l} style={{background:'var(--surface-raised)',borderRadius:'var(--r)',padding:'14px 16px'}}>
                      <div style={{fontSize:11,fontWeight:700,color:'var(--text-muted)',textTransform:'uppercase',letterSpacing:'0.05em',marginBottom:6}}>{l}</div>
                      <div style={{fontSize:15,fontWeight:700,color:'var(--text)'}}>{v}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          <div style={{height:32}}/>
        </div>
      </div>
    </div>
  );
}
