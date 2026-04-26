import { useEffect, useMemo, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';
import ChatWidget from './ChatWidget';
import useAppointmentSocket from '../hooks/useAppointmentSocket';
import {
  getStoredUser, getErrMsg, ROLE_CFG,
  Sidebar, DashHeader, StatusBadge, EmptyState, SectionDivider,
  IcoHome, IcoCalendar, IcoClock, IcoUser, IcoUsers, IcoFolder, IcoPlus,
  IcoShield, IcoCheck, IcoAlert, IcoBuilding, IcoClipboard, IcoActivity, IcoSettings,
} from './Dashboard';

/* role badge colours */
const ROLE_CLR = {
  patient:{bg:'rgba(13,148,136,0.1)',color:'#0D9488'},
  doctor:{bg:'rgba(124,58,237,0.1)',color:'#7C3AED'},
  admin:{bg:'rgba(217,119,6,0.1)',color:'#D97706'},
};
const STATUS_CLR = {active:{bg:'#D1FAE5',color:'#065F46'},suspended:{bg:'#FEE2E2',color:'#991B1B'}};
const CRED_CLR = {pending:{bg:'#FEF3C7',color:'#92400E'},verified:{bg:'#D1FAE5',color:'#065F46'},rejected:{bg:'#FEE2E2',color:'#991B1B'}};

function RoleBadge({role}){const c=ROLE_CLR[role]||ROLE_CLR.patient;return<span style={{display:'inline-flex',alignItems:'center',gap:4,padding:'3px 9px',borderRadius:999,fontSize:11,fontWeight:600,background:c.bg,color:c.color,textTransform:'capitalize'}}>{role}</span>;}
function AcctStatusBadge({status}){const c=STATUS_CLR[status]||STATUS_CLR.active;return<span style={{display:'inline-flex',alignItems:'center',gap:4,padding:'3px 9px',borderRadius:999,fontSize:11,fontWeight:600,background:c.bg,color:c.color,textTransform:'capitalize'}}>{status||'active'}</span>;}
function CredBadge({status}){if(!status)return null;const c=CRED_CLR[status]||CRED_CLR.pending;return<span style={{display:'inline-flex',alignItems:'center',gap:4,padding:'3px 9px',borderRadius:999,fontSize:11,fontWeight:600,background:c.bg,color:c.color,textTransform:'capitalize'}}>{status}</span>;}

export default function AdminDashboard() {
  const storedUser = getStoredUser();
  const [user, setUser]         = useState(storedUser);
  const [allUsers, setAllUsers] = useState([]);
  const [appointments, setAppts]= useState([]);
  const [patients, setPts]      = useState([]);
  const [departments, setDepts] = useState([]);
  const [organizations, setOrgs]= useState([]);
  const [auditLog, setAudit]    = useState([]);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState('');
  const [success, setSuccess]   = useState('');
  const [activeTab, setActiveTab] = useState('overview');
  const [userFilter, setUserFilter] = useState('all');
  const [deptForm, setDeptForm] = useState({name:'',head:''});
  const [orgForm, setOrgForm]   = useState({name:'',type:'clinic',city:''});
  const navigate = useNavigate();

  const role = 'admin';
  const cfg  = ROLE_CFG.admin;
  const hour = new Date().getHours();
  const greeting = hour<12?'Good morning':hour<17?'Good afternoon':'Good evening';
  const dateStr  = new Date().toLocaleDateString('en-US',{weekday:'long',month:'long',day:'numeric'});

  const fetchData = async()=>{
    setLoading(true); setError('');
    try {
      const [meRes,usRes,apRes,ptRes,dpRes,orRes,auRes] = await Promise.all([
        api.get('/me'), api.get('/users'), api.get('/appointments'),
        api.get('/patients'), api.get('/departments'), api.get('/organizations'), api.get('/audit-log'),
      ]);
      setUser(meRes.data.user); localStorage.setItem('hms_user',JSON.stringify(meRes.data.user));
      setAllUsers(usRes.data); setAppts(apRes.data); setPts(ptRes.data);
      setDepts(dpRes.data); setOrgs(orRes.data); setAudit(auRes.data);
    } catch(err){ setError(getErrMsg(err,'Could not load admin data.')); }
    finally { setLoading(false); }
  };

  useEffect(()=>{ fetchData(); },[]);
  useEffect(()=>{ if(!success) return; const t=setTimeout(()=>setSuccess(''),4000); return ()=>clearTimeout(t); },[success]);
  const logout = ()=>{ localStorage.removeItem('hms_token'); localStorage.removeItem('hms_user'); navigate('/login'); };

  /* ── Real-time Socket.IO sync ── */
  const handleAppointmentCreated = useCallback((appt) => {
    setAppts(prev => {
      if (prev.some(a => a.id === appt.id)) return prev;
      return [...prev, appt];
    });
    setSuccess('New appointment created in system.');
  }, []);

  const handleAppointmentUpdated = useCallback((appt) => {
    setAppts(prev => prev.map(a => a.id === appt.id ? appt : a));
    setSuccess(`Appointment ${appt.status}.`);
  }, []);

  useAppointmentSocket(user, handleAppointmentCreated, handleAppointmentUpdated);

  /* computed */
  const filteredUsers = useMemo(()=>{
    if (userFilter==='all') return allUsers;
    return allUsers.filter(u=>u.role===userFilter);
  },[allUsers,userFilter]);
  const doctorCount  = useMemo(()=>allUsers.filter(u=>u.role==='doctor').length,[allUsers]);
  const patientCount = useMemo(()=>allUsers.filter(u=>u.role==='patient').length,[allUsers]);
  const suspendedCount = useMemo(()=>allUsers.filter(u=>u.status==='suspended').length,[allUsers]);

  /* admin actions */
  const changeRole = async(id,newRole)=>{
    setError(''); setSuccess('');
    try { await api.put(`/users/${id}/role`,{role:newRole}); setSuccess('Role updated.'); fetchData(); }
    catch(err){ setError(getErrMsg(err,'Could not change role.')); }
  };
  const toggleStatus = async(id,current)=>{
    const newStatus = current==='suspended'?'active':'suspended';
    setError(''); setSuccess('');
    try { await api.put(`/users/${id}/status`,{status:newStatus}); setSuccess(`User ${newStatus}.`); fetchData(); }
    catch(err){ setError(getErrMsg(err,'Could not change status.')); }
  };
  const verifyDoctor = async(id,credentialStatus)=>{
    setError(''); setSuccess('');
    try { await api.put(`/users/${id}/verify`,{credentialStatus}); setSuccess(`Credentials ${credentialStatus}.`); fetchData(); }
    catch(err){ setError(getErrMsg(err,'Could not update credentials.')); }
  };
  const updateApptStatus = async(id,status)=>{
    setError(''); setSuccess('');
    try { await api.put(`/appointments/${id}/status`,{status}); setSuccess(`Appointment ${status}.`); fetchData(); }
    catch(err){ setError(getErrMsg(err,'Could not update.')); }
  };
  const addDept = async(e)=>{
    e.preventDefault(); setError(''); setSuccess('');
    try { await api.post('/departments',deptForm); setSuccess('Department created!'); setDeptForm({name:'',head:''}); fetchData(); }
    catch(err){ setError(getErrMsg(err,'Could not create department.')); }
  };
  const deleteDept = async(id)=>{
    setError(''); setSuccess('');
    try { await api.delete(`/departments/${id}`); setSuccess('Department deleted.'); fetchData(); }
    catch(err){ setError(getErrMsg(err,'Could not delete.')); }
  };
  const addOrg = async(e)=>{
    e.preventDefault(); setError(''); setSuccess('');
    try { await api.post('/organizations',orgForm); setSuccess('Organization created!'); setOrgForm({name:'',type:'clinic',city:''}); fetchData(); }
    catch(err){ setError(getErrMsg(err,'Could not create organization.')); }
  };
  const deleteOrg = async(id)=>{
    setError(''); setSuccess('');
    try { await api.delete(`/organizations/${id}`); setSuccess('Organization deleted.'); fetchData(); }
    catch(err){ setError(getErrMsg(err,'Could not delete.')); }
  };

  const scrollTo = (id)=>{ setActiveTab(id); document.getElementById(`adm-${id}`)?.scrollIntoView({behavior:'smooth',block:'start'}); };

  const NAV = [
    { id:'overview', label:'Overview',  icon:<IcoHome/> },
    { id:'users',    label:'Users',     icon:<IcoUsers/>,badge:allUsers.length||null },
    { id:'orgs',     label:'Organizations',icon:<IcoBuilding/> },
    { id:'schedule', label:'Scheduling',icon:<IcoCalendar/> },
    { id:'audit',    label:'Audit Log', icon:<IcoActivity/> },
  ];

  const STATS = [
    { label:'Total Users',   value:allUsers.length,    note:`${doctorCount} doctors · ${patientCount} patients`, icon:<IcoUsers/>, color:'#D97706', bg:'rgba(217,119,6,0.1)' },
    { label:'Appointments',  value:appointments.length, note:'System-wide', icon:<IcoCalendar/>, color:'#7C3AED', bg:'rgba(124,58,237,0.1)' },
    { label:'Departments',   value:departments.length,  note:'Active departments', icon:<IcoClipboard/>, color:'#0D9488', bg:'rgba(13,148,136,0.1)' },
    { label:'Suspended',     value:suspendedCount,      note:'Suspended accounts', icon:<IcoShield/>, color:'#EF4444', bg:'rgba(239,68,68,0.1)' },
  ];

  const roleOpts = ['patient','doctor','admin'];

  return (
    <>
      <Sidebar user={user} role={role} navItems={NAV} activeTab={activeTab} onNav={scrollTo} onLogout={logout}/>
      <div className="dash2-workspace">
        <DashHeader role={role} error={error} success={success} onLogout={logout}/>
        <div className="dash2-content">

          {/* ── GREETING ── */}
          <div id="adm-overview" style={{scrollMarginTop:80}}>
            <div className="dash2-greeting">
              <div className="dash2-greeting-orb"/><div className="dash2-greeting-orb2"/>
              <div style={{position:'relative',zIndex:1}}>
                <div className="dash2-greeting-hi">{greeting} 👋</div>
                <div className="dash2-greeting-name">{user.name?.split(' ')[0]||'Admin'}</div>
                <div className="dash2-greeting-sub">{cfg.sub}</div>
                <div className="dash2-greeting-meta">
                  <div className="dash2-greeting-chip"><IcoCalendar/>{dateStr}</div>
                  <div className="dash2-greeting-chip"><IcoUsers/>{allUsers.length} users</div>
                  {suspendedCount>0 && <div className="dash2-greeting-chip"><IcoShield/>{suspendedCount} suspended</div>}
                </div>
              </div>
            </div>
          </div>

          {/* ── STATS ── */}
          <div className="dash2-stats">
            {STATS.map((s,i)=>(
              <div key={s.label} className="dash2-stat-card" style={{animationDelay:`${i*0.07}s`}}>
                <div className="dash2-stat-top">
                  <div className="dash2-stat-icon" style={{background:s.bg,color:s.color}}>{s.icon}</div>
                </div>
                <div className="dash2-stat-val">{loading?'—':s.value}</div>
                <div className="dash2-stat-label">{s.label}</div>
                <div className="dash2-stat-note">{s.note}</div>
              </div>
            ))}
          </div>

          {/* ── USER MANAGEMENT ── */}
          <div id="adm-users" style={{scrollMarginTop:80}}>
            <SectionDivider title="User Management" action={`${allUsers.length} total`}/>
            {/* filter pills */}
            <div style={{display:'flex',gap:6,marginBottom:16,flexWrap:'wrap'}}>
              {['all','patient','doctor','admin'].map(f=>(
                <button key={f} className={`dash2-filter-pill${userFilter===f?' active':''}`} onClick={()=>setUserFilter(f)}>
                  {f==='all'?'All Users':f.charAt(0).toUpperCase()+f.slice(1)+'s'}
                  <span className="dash2-filter-count">{f==='all'?allUsers.length:allUsers.filter(u=>u.role===f).length}</span>
                </button>
              ))}
            </div>
            <div className="dash2-panel">
              <div className="dash2-panel-head">
                <div>
                  <div className="dash2-panel-title">Users</div>
                  <div className="dash2-panel-sub">{filteredUsers.length} shown · filter by role above</div>
                </div>
              </div>
              {loading ? <div className="skeleton" style={{height:200,margin:20,borderRadius:'var(--r)'}}/> :
                filteredUsers.length>0 ? (
                <div className="dash2-table-wrap" style={{maxHeight:440}}>
                  <table className="dash2-table">
                    <thead><tr>{['Name','Email','Role','Status','Credentials','Actions'].map(h=><th key={h}>{h}</th>)}</tr></thead>
                    <tbody>
                      {filteredUsers.map(u=>(
                        <tr key={u.id}>
                          <td style={{fontWeight:600}}>{u.name}</td>
                          <td style={{color:'var(--text-muted)',fontSize:12}}>{u.email}</td>
                          <td><RoleBadge role={u.role}/></td>
                          <td><AcctStatusBadge status={u.status}/></td>
                          <td>{u.role==='doctor'?<CredBadge status={u.credentialStatus}/>:<span style={{color:'var(--text-subtle)',fontSize:12}}>—</span>}</td>
                          <td>
                            <div style={{display:'flex',gap:4,flexWrap:'wrap'}}>
                              {u.id!==user.id && (
                                <>
                                  <select className="dash2-mini-select" value={u.role} onChange={e=>changeRole(u.id,e.target.value)}>
                                    {roleOpts.map(r=><option key={r} value={r}>{r}</option>)}
                                  </select>
                                  <button className={`dash2-action-btn ${u.status==='suspended'?'dash2-action-confirm':'dash2-action-cancel'}`} onClick={()=>toggleStatus(u.id,u.status)}>
                                    {u.status==='suspended'?'Activate':'Suspend'}
                                  </button>
                                  {u.role==='doctor' && u.credentialStatus!=='verified' && (
                                    <button className="dash2-action-btn dash2-action-confirm" onClick={()=>verifyDoctor(u.id,'verified')}>Verify</button>
                                  )}
                                  {u.role==='doctor' && u.credentialStatus==='verified' && (
                                    <button className="dash2-action-btn dash2-action-cancel" onClick={()=>verifyDoctor(u.id,'rejected')}>Revoke</button>
                                  )}
                                </>
                              )}
                              {u.id===user.id && <span style={{fontSize:11,color:'var(--text-subtle)'}}>You</span>}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : <EmptyState icon="👤" text="No users found."/>}
            </div>
          </div>

          {/* ── ORGANIZATIONS & DEPARTMENTS ── */}
          <div id="adm-orgs" style={{scrollMarginTop:80}}>
            <SectionDivider title="Organization Management"/>
            <div className="dash2-two-col">

              {/* departments */}
              <div className="dash2-panel">
                <div className="dash2-panel-head">
                  <div>
                    <div className="dash2-panel-title">Departments</div>
                    <div className="dash2-panel-sub">{departments.length} active</div>
                  </div>
                </div>
                <div className="dash2-panel-body">
                  <form onSubmit={addDept} style={{display:'flex',gap:8,marginBottom:16}}>
                    <input className="dash2-inp" style={{flex:1,height:36,fontSize:13}} value={deptForm.name} onChange={e=>setDeptForm(p=>({...p,name:e.target.value}))} required placeholder="Department name"/>
                    <input className="dash2-inp" style={{width:120,height:36,fontSize:13}} value={deptForm.head} onChange={e=>setDeptForm(p=>({...p,head:e.target.value}))} placeholder="Head (optional)"/>
                    <button type="submit" className="dash2-action-btn dash2-action-confirm" style={{height:36,padding:'0 14px'}}>Add</button>
                  </form>
                  {departments.length>0 ? (
                    <div style={{display:'flex',flexDirection:'column',gap:6}}>
                      {departments.map(d=>(
                        <div key={d.id} className="dash2-list-item">
                          <div style={{flex:1,minWidth:0}}>
                            <div style={{fontSize:13,fontWeight:600,color:'var(--text)'}}>{d.name}</div>
                            {d.head && <div style={{fontSize:11,color:'var(--text-muted)'}}>Head: {d.head}</div>}
                          </div>
                          <button className="dash2-action-btn dash2-action-cancel" onClick={()=>deleteDept(d.id)}>Delete</button>
                        </div>
                      ))}
                    </div>
                  ) : <EmptyState icon="📁" text="No departments yet."/>}
                </div>
              </div>

              {/* organizations */}
              <div className="dash2-panel">
                <div className="dash2-panel-head">
                  <div>
                    <div className="dash2-panel-title">Clinics & Hospitals</div>
                    <div className="dash2-panel-sub">{organizations.length} registered</div>
                  </div>
                </div>
                <div className="dash2-panel-body">
                  <form onSubmit={addOrg} style={{display:'flex',gap:8,marginBottom:16,flexWrap:'wrap'}}>
                    <input className="dash2-inp" style={{flex:1,minWidth:120,height:36,fontSize:13}} value={orgForm.name} onChange={e=>setOrgForm(p=>({...p,name:e.target.value}))} required placeholder="Organization name"/>
                    <select className="dash2-mini-select" style={{height:36}} value={orgForm.type} onChange={e=>setOrgForm(p=>({...p,type:e.target.value}))}>
                      <option value="clinic">Clinic</option>
                      <option value="hospital">Hospital</option>
                      <option value="lab">Lab</option>
                    </select>
                    <input className="dash2-inp" style={{width:100,height:36,fontSize:13}} value={orgForm.city} onChange={e=>setOrgForm(p=>({...p,city:e.target.value}))} placeholder="City"/>
                    <button type="submit" className="dash2-action-btn dash2-action-confirm" style={{height:36,padding:'0 14px'}}>Add</button>
                  </form>
                  {organizations.length>0 ? (
                    <div style={{display:'flex',flexDirection:'column',gap:6}}>
                      {organizations.map(o=>(
                        <div key={o.id} className="dash2-list-item">
                          <div style={{flex:1,minWidth:0}}>
                            <div style={{fontSize:13,fontWeight:600,color:'var(--text)'}}>{o.name}</div>
                            <div style={{fontSize:11,color:'var(--text-muted)'}}>{o.type}{o.city?` · ${o.city}`:''}</div>
                          </div>
                          <button className="dash2-action-btn dash2-action-cancel" onClick={()=>deleteOrg(o.id)}>Delete</button>
                        </div>
                      ))}
                    </div>
                  ) : <EmptyState icon="🏥" text="No organizations yet."/>}
                </div>
              </div>
            </div>
          </div>

          {/* ── SCHEDULING OVERVIEW ── */}
          <div id="adm-schedule" style={{scrollMarginTop:80}}>
            <SectionDivider title="Scheduling Overview" action={`${appointments.length} appointments`}/>
            <div className="dash2-panel">
              <div className="dash2-panel-head">
                <div>
                  <div className="dash2-panel-title">All Appointments</div>
                  <div className="dash2-panel-sub">System-wide · manage status</div>
                </div>
              </div>
              {loading ? <div className="skeleton" style={{height:200,margin:20,borderRadius:'var(--r)'}}/> :
                appointments.length>0 ? (
                <div className="dash2-table-wrap" style={{maxHeight:400}}>
                  <table className="dash2-table">
                    <thead><tr>{['#','Doctor','Patient','Date','Time','Status','Actions'].map(h=><th key={h}>{h}</th>)}</tr></thead>
                    <tbody>
                      {appointments.map(a=>(
                        <tr key={a.id}>
                          <td style={{color:'var(--text-muted)',fontFamily:'monospace',fontSize:12}}>#{a.id?.slice(-6)}</td>
                          <td style={{fontWeight:600}}>{a.doctorId}</td>
                          <td style={{color:'var(--text-muted)'}}>{a.patientId?.slice(-6)||'—'}</td>
                          <td>{a.date}</td>
                          <td style={{color:'var(--text-muted)'}}>{a.time}</td>
                          <td><StatusBadge status={a.status}/></td>
                          <td>
                            <div style={{display:'flex',gap:4}}>
                              {(a.status||'pending')!=='completed' && (a.status||'pending')!=='cancelled' && (
                                <>
                                  {(a.status||'pending')==='pending' && <button className="dash2-action-btn dash2-action-confirm" onClick={()=>updateApptStatus(a.id,'confirmed')}>Confirm</button>}
                                  {a.status==='confirmed' && <button className="dash2-action-btn dash2-action-complete" onClick={()=>updateApptStatus(a.id,'completed')}>Complete</button>}
                                  <button className="dash2-action-btn dash2-action-cancel" onClick={()=>updateApptStatus(a.id,'cancelled')}>Cancel</button>
                                </>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : <EmptyState icon="🗓️" text="No appointments in the system."/>}
            </div>
          </div>

          {/* ── AUDIT LOG ── */}
          <div id="adm-audit" style={{scrollMarginTop:80}}>
            <SectionDivider title="Security & Audit Log" action={`${auditLog.length} entries`}/>
            <div className="dash2-panel">
              <div className="dash2-panel-head">
                <div>
                  <div className="dash2-panel-title">Recent Activity</div>
                  <div className="dash2-panel-sub">Who did what, and when</div>
                </div>
              </div>
              <div className="dash2-panel-body" style={{maxHeight:400,overflowY:'auto'}}>
                {loading ? <div className="skeleton" style={{height:160,borderRadius:'var(--r)'}}/> :
                  auditLog.length>0 ? (
                  <div className="dash2-audit-feed">
                    {auditLog.slice(0,50).map((entry,i)=>(
                      <div key={entry.id||i} className="dash2-audit-entry" style={{animationDelay:`${i*0.03}s`}}>
                        <div className="dash2-audit-dot"/>
                        <div style={{flex:1,minWidth:0}}>
                          <div style={{fontSize:13,color:'var(--text)'}}>
                            <strong>{entry.actorName}</strong>
                            <span style={{color:'var(--text-muted)'}}> ({entry.actorRole})</span>
                            {' — '}{entry.action}
                          </div>
                          {entry.target && (
                            <div style={{fontSize:11,color:'var(--text-subtle)',marginTop:2}}>
                              {Object.entries(entry.target).map(([k,v])=>`${k}: ${v}`).join(' · ')}
                            </div>
                          )}
                        </div>
                        <div style={{fontSize:11,color:'var(--text-subtle)',whiteSpace:'nowrap',flexShrink:0}}>
                          {new Date(entry.timestamp).toLocaleString('en-US',{month:'short',day:'numeric',hour:'2-digit',minute:'2-digit'})}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : <EmptyState icon="📋" text="No audit entries yet. Actions will be logged here."/>}
              </div>
            </div>
          </div>

          <div style={{height:32}}/>
        </div>
      </div>
      <ChatWidget user={user}/>
    </>
  );
}
