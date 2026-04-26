import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';
import PatientDashboard from './PatientDashboard';
import DoctorDashboard from './DoctorDashboard';
import AdminDashboard from './AdminDashboard';

/* ── helpers (shared) ── */
export function getStoredUser() { return JSON.parse(localStorage.getItem('hms_user') || '{}'); }
export function getErrMsg(err, fallback) {
  if (err?.response?.data?.message) return err.response.data.message;
  if (err?.request) return 'Cannot reach the API server. Start the backend on port 5000.';
  return fallback;
}

/* ── status colours (shared) ── */
export const STATUS = {
  pending:   { dot:'#F59E0B', bg:'#FEF3C7', color:'#92400E' },
  confirmed: { dot:'#7C3AED', bg:'#EDE9FE', color:'#5B21B6' },
  completed: { dot:'#10B981', bg:'#D1FAE5', color:'#065F46' },
  cancelled: { dot:'#EF4444', bg:'#FEE2E2', color:'#991B1B' },
};

/* ── role config (shared) ── */
export const ROLE_CFG = {
  patient: { cls:'role-patient', label:'Patient Portal',   sub:'Book appointments and manage your health records.' },
  doctor:  { cls:'role-doctor',  label:'Doctor Workspace', sub:'Manage your patients, schedule, and clinical notes.' },
  admin:   { cls:'role-admin',   label:'Admin Console',    sub:'Oversee the system, users, and all operations.' },
};

/* ── icons (shared) ── */
export const Ico = ({ d, extra, size=16 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    {extra}{d && <path d={d}/>}
  </svg>
);
export const IcoHome     = () => <Ico extra={<><path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></>}/>;
export const IcoUser     = () => <Ico extra={<><circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/></>}/>;
export const IcoCalendar = () => <Ico extra={<><rect x="3" y="4" width="18" height="17" rx="2"/><path d="M8 2v4M16 2v4M3 10h18"/></>}/>;
export const IcoFolder   = () => <Ico extra={<><path d="M3 7a2 2 0 0 1 2-2h5l2 2h7a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2Z"/><path d="M3 10h18"/></>}/>;
export const IcoPlus     = () => <Ico d="M12 5v14M5 12h14"/>;
export const IcoLogout   = () => <Ico d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9"/>;
export const IcoClock    = () => <Ico extra={<><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></>}/>;
export const IcoShield   = () => <Ico extra={<><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z"/><path d="m9 12 2 2 4-4"/></>}/>;
export const IcoUsers    = () => <Ico extra={<><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/></>}/>;
export const IcoCheck    = () => <Ico d="M20 6 9 17l-5-5"/>;
export const IcoAlert    = () => <Ico extra={<><circle cx="12" cy="12" r="10"/><path d="M12 8v4M12 16h.01"/></>}/>;
export const IcoSpin     = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" style={{animation:'spin 0.7s linear infinite'}}><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>;
export const IcoChevron  = () => <Ico d="m9 18 6-6-6-6" size={12}/>;
export const IcoBuilding = () => <Ico extra={<><path d="M6 22V4a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v18Z"/><path d="M6 12H4a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h2M18 9h2a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2h-2M10 6h4M10 10h4M10 14h4M10 18h4"/></>}/>;
export const IcoClipboard= () => <Ico extra={<><rect x="8" y="2" width="8" height="4" rx="1"/><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><path d="M12 11h4M12 16h4M8 11h.01M8 16h.01"/></>}/>;
export const IcoActivity = () => <Ico d="M22 12h-4l-3 8L9 4l-3 8H2"/>;
export const IcoSettings = () => <Ico extra={<><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1Z"/></>}/>;

/* ── shared UI pieces ── */
export function StatusBadge({ status }) {
  const s = (status||'pending').toLowerCase();
  const c = STATUS[s] || STATUS.pending;
  return (
    <span style={{display:'inline-flex',alignItems:'center',gap:5,padding:'3px 9px',borderRadius:999,fontSize:11,fontWeight:600,background:c.bg,color:c.color}}>
      <span style={{width:5,height:5,borderRadius:'50%',background:c.dot}}/>{s}
    </span>
  );
}

export function EmptyState({ icon, text }) {
  return (
    <div style={{textAlign:'center',padding:'48px 20px',color:'var(--text-muted)'}}>
      <div style={{fontSize:32,marginBottom:10,opacity:0.4}}>{icon}</div>
      <div style={{fontSize:13}}>{text}</div>
    </div>
  );
}

export function SectionDivider({ title, action }) {
  return (
    <div className="dash2-divider">
      <span className="dash2-divider-title">{title}</span>
      <div className="dash2-divider-line"/>
      {action && <span className="dash2-divider-action">{action}</span>}
    </div>
  );
}

/* ════════════════════════════
   SIDEBAR (shared)
════════════════════════════ */
export function Sidebar({ user, role, navItems, activeTab, onNav, onLogout }) {
  const cfg = ROLE_CFG[role] || ROLE_CFG.patient;
  const navigate = useNavigate();

  return (
    <aside className={`dash2-sidebar ${cfg.cls}`}>
      <div className="dash2-logo">
        <div className="dash2-logo-icon"><IcoPlus/></div>
        MedFlow
      </div>

      <nav className="dash2-nav">
        <div className="dash2-nav-section">Workspace</div>
        {navItems.map(({ id, label, icon, badge }) => (
          <button key={id} className={`dash2-nav-btn${activeTab===id?' active':''}`} onClick={()=>onNav(id)}>
            {icon}{label}
            {badge != null && <span className="dash2-nav-badge">{badge}</span>}
          </button>
        ))}

        <div className="dash2-nav-section" style={{marginTop:8}}>Account</div>
        <button className="dash2-nav-btn" onClick={()=>navigate('/profile')}>
          <IcoUser/>Profile
        </button>
        <button className="dash2-nav-btn" onClick={onLogout}>
          <IcoLogout/>Sign out
        </button>
      </nav>

      <div className="dash2-user-card">
        <div className="dash2-avatar">{(user.name||'U')[0].toUpperCase()}</div>
        <div style={{flex:1,minWidth:0}}>
          <div className="dash2-user-name">{user.name||'User'}</div>
          <div className="dash2-user-role">{role}</div>
        </div>
      </div>
    </aside>
  );
}

/* ════════════════════════════
   HEADER (shared)
════════════════════════════ */
export function DashHeader({ role, error, success, onLogout }) {
  const cfg = ROLE_CFG[role] || ROLE_CFG.patient;
  return (
    <header className="dash2-header">
      <div className="dash2-breadcrumb">
        MedFlow <IcoChevron/> <strong>{cfg.label}</strong>
      </div>
      <div className="dash2-header-actions">
        {error && <div className="dash2-alert dash2-alert-err"><IcoAlert/><span style={{maxWidth:260,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{error}</span></div>}
        {success && <div className="dash2-alert dash2-alert-ok"><IcoCheck/>{success}</div>}
        <div className="dash2-role-pill"><span className="dash2-role-dot"/>{role}</div>
        <button className="dash2-icon-btn" onClick={onLogout} title="Sign out"><IcoLogout/></button>
      </div>
    </header>
  );
}

/* ════════════════════════════
   DASHBOARD — ROUTER
════════════════════════════ */
export default function Dashboard() {
  const storedUser = getStoredUser();
  const role = storedUser.role || 'patient';
  const cfg = ROLE_CFG[role] || ROLE_CFG.patient;

  if (role === 'doctor') return <div className={`dash2-root ${cfg.cls}`}><DoctorDashboard/></div>;
  if (role === 'admin')  return <div className={`dash2-root ${cfg.cls}`}><AdminDashboard/></div>;
  return <div className={`dash2-root ${cfg.cls}`}><PatientDashboard/></div>;
}
