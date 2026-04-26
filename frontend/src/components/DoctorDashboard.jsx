import { useEffect, useMemo, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';
import ChatWidget from './ChatWidget';
import useAppointmentSocket from '../hooks/useAppointmentSocket';
import {
  getStoredUser, getErrMsg, ROLE_CFG,
  Sidebar, DashHeader, StatusBadge, EmptyState, SectionDivider,
  IcoHome, IcoCalendar, IcoClock, IcoUser, IcoUsers, IcoFolder, IcoPlus, IcoCheck, IcoAlert,
} from './Dashboard';

export default function DoctorDashboard() {
  const storedUser = getStoredUser();
  const [user, setUser]          = useState(storedUser);
  const [appointments, setAppts] = useState([]);
  const [patients, setPts]       = useState([]);
  const [allUsers, setAllUsers]  = useState([]);
  const [loading, setLoading]    = useState(true);
  const [error, setError]        = useState('');
  const [success, setSuccess]    = useState('');
  const [ptForm, setPtForm]      = useState({ name:'', age:'', contact:'' });
  const [apptForm, setApptForm]  = useState({ patientId:'', date:'', time:'', notes:'' });
  const [activeTab, setActiveTab]= useState('overview');
  const [ptSearch, setPtSearch]  = useState('');
  const navigate = useNavigate();

  const role  = 'doctor';
  const cfg   = ROLE_CFG.doctor;
  const today = new Date().toISOString().split('T')[0];
  const hour  = new Date().getHours();
  const greeting = hour<12?'Good morning':hour<17?'Good afternoon':'Good evening';
  const dateStr  = new Date().toLocaleDateString('en-US',{weekday:'long',month:'long',day:'numeric'});

  /* ── Fetch initial data from REST API ── */
  const fetchData = async()=>{
    setLoading(true); setError('');
    try {
      const [meRes,apRes,ptRes] = await Promise.all([
        api.get('/me'), api.get('/appointments'), api.get('/patients'),
      ]);
      setUser(meRes.data.user); localStorage.setItem('hms_user',JSON.stringify(meRes.data.user));
      setAppts(apRes.data); setPts(ptRes.data);

      // Also fetch patient-role users for the appointment patient selector
      try {
        const usRes = await api.get('/users');
        setAllUsers(usRes.data.filter(u => u.role === 'patient'));
      } catch(e) {
        // /users may be admin-only; fallback to patients list
        setAllUsers([]);
      }
    } catch(err){ setError(getErrMsg(err,'Could not load data.')); }
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
    setSuccess(`New appointment: ${appt.patientName || 'Patient'} on ${appt.date}`);
  }, []);

  const handleAppointmentUpdated = useCallback((appt) => {
    setAppts(prev => prev.map(a => a.id === appt.id ? appt : a));
    setSuccess(`Appointment ${appt.status} — ${appt.patientName || 'Patient'}`);
  }, []);

  useAppointmentSocket(user, handleAppointmentCreated, handleAppointmentUpdated);

  /* ── Derived data ── */
  const sortedAppts = useMemo(()=>
    [...appointments].sort((a,b)=>new Date(`${a.date}T${a.time}`)-new Date(`${b.date}T${b.time}`)),
    [appointments]
  );
  const todayAppts = useMemo(()=>sortedAppts.filter(a=>a.date===today),[sortedAppts,today]);
  const pendingCount = useMemo(()=>appointments.filter(a=>(a.status||'pending')==='pending').length,[appointments]);
  const confirmedCount = useMemo(()=>appointments.filter(a=>a.status==='confirmed').length,[appointments]);

  const filteredPts = useMemo(()=>{
    if (!ptSearch.trim()) return patients;
    const q = ptSearch.toLowerCase();
    return patients.filter(p=>p.name?.toLowerCase().includes(q)||p.contact?.includes(q));
  },[patients,ptSearch]);

  // Build a combined patient list for the appointment form dropdown
  const patientOptions = useMemo(()=>{
    const map = new Map();
    // Users with patient role
    allUsers.forEach(u => map.set(u.id, { id: u.id, name: u.name, email: u.email }));
    // Patients from registry (may not be system users)
    patients.forEach(p => { if (!map.has(p.id)) map.set(p.id, { id: p.id, name: p.name }); });
    return Array.from(map.values());
  },[allUsers, patients]);

  /* ── Actions ── */
  const createAppointment = async(e)=>{
    e.preventDefault(); setError(''); setSuccess('');
    try {
      const payload = {
        doctorId: user.id,
        patientId: apptForm.patientId,
        date: apptForm.date,
        time: apptForm.time,
        notes: apptForm.notes,
      };
      const res = await api.post('/appointments', payload);
      // Optimistic add (socket event will deduplicate)
      setAppts(prev => prev.some(a => a.id === res.data.id) ? prev : [...prev, res.data]);
      setSuccess('Appointment created!');
      setApptForm({ patientId:'', date:'', time:'', notes:'' });
    }
    catch(err){ setError(getErrMsg(err,'Could not create appointment.')); }
  };

  const addPatient = async(e)=>{
    e.preventDefault(); setError(''); setSuccess('');
    try { await api.post('/patients',ptForm); setSuccess('Patient registered!'); setPtForm({name:'',age:'',contact:''}); fetchData(); }
    catch(err){ setError(getErrMsg(err,'Could not add patient.')); }
  };

  const updateApptStatus = async(id,status)=>{
    setError(''); setSuccess('');
    try {
      const res = await api.put(`/appointments/${id}/status`,{status});
      // Optimistic update (socket event will sync)
      setAppts(prev => prev.map(a => a.id === id ? res.data : a));
      setSuccess(`Appointment ${status}.`);
    }
    catch(err){ setError(getErrMsg(err,'Could not update status.')); }
  };

  const scrollTo = (id)=>{ setActiveTab(id); document.getElementById(`doc-${id}`)?.scrollIntoView({behavior:'smooth',block:'start'}); };

  const NAV = [
    { id:'overview',  label:'Overview',  icon:<IcoHome/> },
    { id:'create',    label:'Create Appt',icon:<IcoPlus/> },
    { id:'schedule',  label:'Schedule',  icon:<IcoClock/>,badge:todayAppts.length||null },
    { id:'patients',  label:'Patients',  icon:<IcoUsers/>,badge:patients.length||null },
    { id:'records',   label:'Records',   icon:<IcoFolder/> },
  ];

  const STATS = [
    { label:'Total Appts',  value:appointments.length, note:'All appointments', icon:<IcoCalendar/>, color:'#7C3AED', bg:'rgba(124,58,237,0.1)' },
    { label:'Today',        value:todayAppts.length, note:'Appointments today', icon:<IcoClock/>, color:'#0D9488', bg:'rgba(13,148,136,0.1)' },
    { label:'Pending',      value:pendingCount, note:'Awaiting confirmation', icon:<IcoAlert/>, color:'#F59E0B', bg:'rgba(245,158,11,0.1)' },
    { label:'Patients',     value:patients.length, note:'In registry', icon:<IcoUsers/>, color:'#10B981', bg:'rgba(16,185,129,0.1)' },
  ];

  /* status action buttons */
  const statusActions = (appt) => {
    const s = (appt.status||'pending').toLowerCase();
    const actions = [];
    if (s==='pending')   actions.push({label:'Confirm',  status:'confirmed', cls:'dash2-action-confirm'});
    if (s==='confirmed') actions.push({label:'Complete', status:'completed', cls:'dash2-action-complete'});
    if (s!=='cancelled'&&s!=='completed') actions.push({label:'Cancel',status:'cancelled',cls:'dash2-action-cancel'});
    return actions;
  };

  return (
    <>
      <Sidebar user={user} role={role} navItems={NAV} activeTab={activeTab} onNav={scrollTo} onLogout={logout}/>
      <div className="dash2-workspace">
        <DashHeader role={role} error={error} success={success} onLogout={logout}/>
        <div className="dash2-content">

          {/* ── GREETING ── */}
          <div id="doc-overview" style={{scrollMarginTop:80}}>
            <div className="dash2-greeting">
              <div className="dash2-greeting-orb"/><div className="dash2-greeting-orb2"/>
              <div style={{position:'relative',zIndex:1}}>
                <div className="dash2-greeting-hi">{greeting} 👋</div>
                <div className="dash2-greeting-name">Dr. {user.name?.split(' ')[0]||'there'}</div>
                <div className="dash2-greeting-sub">{cfg.sub}</div>
                <div className="dash2-greeting-meta">
                  <div className="dash2-greeting-chip"><IcoCalendar/>{dateStr}</div>
                  <div className="dash2-greeting-chip"><IcoClock/>{todayAppts.length} appointments today</div>
                  {pendingCount>0 && <div className="dash2-greeting-chip"><IcoAlert/>{pendingCount} pending</div>}
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

          {/* ── CREATE APPOINTMENT ── */}
          <div id="doc-create" style={{scrollMarginTop:80}}>
            <SectionDivider title="Create Appointment"/>
            <div className="dash2-panel">
              <div className="dash2-panel-head">
                <div>
                  <div className="dash2-panel-title">Schedule for a Patient</div>
                  <div className="dash2-panel-sub">Select patient, pick date &amp; time. The patient will see it instantly.</div>
                </div>
                <div style={{color:'var(--role-accent)'}}><IcoPlus/></div>
              </div>
              <div className="dash2-panel-body">
                <form onSubmit={createAppointment} style={{display:'flex',flexDirection:'column',gap:14}}>
                  <div className="dash2-fg"><label>Patient</label>
                    {patientOptions.length > 0 ? (
                      <select
                        className="dash2-inp"
                        value={apptForm.patientId}
                        onChange={e=>setApptForm(p=>({...p,patientId:e.target.value}))}
                        required
                        style={{height:40}}
                      >
                        <option value="">— Select a patient —</option>
                        {patientOptions.map(p => (
                          <option key={p.id} value={p.id}>
                            {p.name}{p.email ? ` (${p.email})` : ''}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <input className="dash2-inp" value={apptForm.patientId} onChange={e=>setApptForm(p=>({...p,patientId:e.target.value}))} required placeholder="Enter patient user ID"/>
                    )}
                  </div>
                  <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12}}>
                    <div className="dash2-fg"><label>Date</label>
                      <input className="dash2-inp" type="date" min={today} value={apptForm.date} onChange={e=>setApptForm(p=>({...p,date:e.target.value}))} required/>
                    </div>
                    <div className="dash2-fg"><label>Time</label>
                      <input className="dash2-inp" type="time" value={apptForm.time} onChange={e=>setApptForm(p=>({...p,time:e.target.value}))} required/>
                    </div>
                  </div>
                  <div className="dash2-fg"><label>Notes <span style={{fontWeight:400,color:'var(--text-subtle)'}}>(optional)</span></label>
                    <textarea className="dash2-inp" rows={2} value={apptForm.notes} onChange={e=>setApptForm(p=>({...p,notes:e.target.value}))} placeholder="Visit reason, follow-up, etc." style={{resize:'vertical',minHeight:44}}/>
                  </div>
                  <button type="submit" className="dash2-submit-btn">Create Appointment</button>
                </form>
              </div>
            </div>
          </div>

          {/* ── SCHEDULE & TODAY ── */}
          <div id="doc-schedule" style={{scrollMarginTop:80}}>
            <SectionDivider title="Today's Schedule" action={`${todayAppts.length} appointments`}/>
            <div className="dash2-panel" style={{marginBottom: 20}}>
                <div className="dash2-panel-head">
                  <div>
                    <div className="dash2-panel-title">Today's Appointments</div>
                    <div className="dash2-panel-sub">{today}</div>
                  </div>
                </div>
                <div className="dash2-panel-body">
                  {loading ? <div className="skeleton" style={{height:120,borderRadius:'var(--r)'}}/> :
                    todayAppts.length>0 ? (
                    <div style={{display:'flex',flexDirection:'column',gap:10}}>
                      {todayAppts.map((a,i)=>(
                        <div key={a.id} className="dash2-schedule-tile" style={{animationDelay:`${i*0.05}s`}}>
                          <div className="dash2-schedule-time">{a.time}</div>
                          <div style={{flex:1,minWidth:0}}>
                            <div style={{fontSize:13,fontWeight:600,color:'var(--text)'}}>{a.patientName || `Patient #${a.patientId?.slice(-6)||'—'}`}</div>
                            <div style={{fontSize:11,color:'var(--text-muted)'}}>
                              {a.notes ? a.notes.slice(0,50) : `ID: ${a.patientId?.slice(-6)}`}
                            </div>
                          </div>
                          <StatusBadge status={a.status}/>
                          <div style={{display:'flex',gap:4}}>
                            {statusActions(a).map(act=>(
                              <button key={act.status} className={`dash2-action-btn ${act.cls}`} onClick={()=>updateApptStatus(a.id,act.status)}>
                                {act.label}
                              </button>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : <EmptyState icon="📅" text="No appointments today."/>}
                </div>
              </div>
          </div>

          {/* ── PATIENTS ── */}
          <div id="doc-patients" style={{scrollMarginTop:80}}>
            <SectionDivider title="Patient Management" action={`${patients.length} registered`}/>
            <div className="dash2-two-col">

              {/* patient registry */}
              <div className="dash2-panel">
                <div className="dash2-panel-head">
                  <div>
                    <div className="dash2-panel-title">Patient Registry</div>
                    <div className="dash2-panel-sub">{filteredPts.length} shown</div>
                  </div>
                  <input className="dash2-inp" style={{width:180,height:32,fontSize:12}} placeholder="Search patients…" value={ptSearch} onChange={e=>setPtSearch(e.target.value)}/>
                </div>
                {loading ? <div className="skeleton" style={{height:160,margin:20,borderRadius:'var(--r)'}}/> :
                  filteredPts.length>0 ? (
                  <div className="dash2-table-wrap">
                    <table className="dash2-table">
                      <thead><tr>{['#','Name','Age','Contact'].map(h=><th key={h}>{h}</th>)}</tr></thead>
                      <tbody>
                        {filteredPts.map(p=>(
                          <tr key={p.id}>
                            <td style={{color:'var(--text-muted)',fontFamily:'monospace',fontSize:12}}>#{p.id?.slice(-6)}</td>
                            <td style={{fontWeight:600}}>{p.name}</td>
                            <td style={{color:'var(--text-muted)'}}>{p.age}</td>
                            <td style={{color:'var(--text-muted)'}}>{p.contact}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : <EmptyState icon="👤" text={ptSearch?'No patients match your search.':'No patients registered yet.'}/>}
              </div>

              {/* add patient */}
              <div className="dash2-panel">
                <div className="dash2-panel-head">
                  <div>
                    <div className="dash2-panel-title">Add Patient</div>
                    <div className="dash2-panel-sub">Register a new patient.</div>
                  </div>
                </div>
                <div className="dash2-panel-body">
                  <form onSubmit={addPatient} style={{display:'flex',flexDirection:'column',gap:14}}>
                    <div className="dash2-fg"><label>Full Name</label>
                      <input className="dash2-inp" value={ptForm.name} onChange={e=>setPtForm(p=>({...p,name:e.target.value}))} required placeholder="Patient full name"/>
                    </div>
                    <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12}}>
                      <div className="dash2-fg"><label>Age</label>
                        <input className="dash2-inp" type="number" min={0} max={150} value={ptForm.age} onChange={e=>setPtForm(p=>({...p,age:e.target.value}))} required placeholder="34"/>
                      </div>
                      <div className="dash2-fg"><label>Contact</label>
                        <input className="dash2-inp" value={ptForm.contact} onChange={e=>setPtForm(p=>({...p,contact:e.target.value}))} required placeholder="+1 555 0100"/>
                      </div>
                    </div>
                    <button type="submit" className="dash2-submit-btn" style={{background:'var(--success)'}}>Register Patient</button>
                  </form>
                </div>
              </div>
            </div>
          </div>

          {/* ── ALL RECORDS ── */}
          <div id="doc-records" style={{scrollMarginTop:80}}>
            <SectionDivider title="All Appointments" action={`${appointments.length} total`}/>
            <div className="dash2-panel">
              <div className="dash2-panel-head">
                <div>
                  <div className="dash2-panel-title">Appointment Records</div>
                  <div className="dash2-panel-sub">Manage status for each appointment</div>
                </div>
              </div>
              {loading ? <div className="skeleton" style={{height:200,margin:20,borderRadius:'var(--r)'}}/> :
                sortedAppts.length>0 ? (
                <div className="dash2-table-wrap">
                  <table className="dash2-table">
                    <thead><tr>{['#','Patient','Date','Time','Status','Notes','Actions'].map(h=><th key={h}>{h}</th>)}</tr></thead>
                    <tbody>
                      {sortedAppts.map(a=>(
                        <tr key={a.id}>
                          <td style={{color:'var(--text-muted)',fontFamily:'monospace',fontSize:12}}>#{a.id?.slice(-6)}</td>
                          <td style={{fontWeight:600}}>{a.patientName || a.patientId?.slice(-6) || '—'}</td>
                          <td>{a.date}</td>
                          <td style={{color:'var(--text-muted)'}}>{a.time}</td>
                          <td><StatusBadge status={a.status}/></td>
                          <td style={{color:'var(--text-muted)',fontSize:12,maxWidth:120,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{a.notes||'—'}</td>
                          <td>
                            <div style={{display:'flex',gap:4}}>
                              {statusActions(a).map(act=>(
                                <button key={act.status} className={`dash2-action-btn ${act.cls}`} onClick={()=>updateApptStatus(a.id,act.status)}>
                                  {act.label}
                                </button>
                              ))}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : <EmptyState icon="🗓️" text="No appointments yet."/>}
            </div>
          </div>

          <div style={{height:32}}/>
        </div>
      </div>
      <ChatWidget user={user}/>
    </>
  );
}
