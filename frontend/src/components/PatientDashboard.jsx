import { useEffect, useMemo, useState, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';
import ChatWidget from './ChatWidget';
import useAppointmentSocket from '../hooks/useAppointmentSocket';
import {
  getStoredUser, getErrMsg, ROLE_CFG,
  Sidebar, DashHeader, StatusBadge, EmptyState, SectionDivider,
  IcoHome, IcoCalendar, IcoClock, IcoUser, IcoShield, IcoFolder, IcoPlus,
  IcoActivity, IcoAlert, IcoSpin,
} from './Dashboard';

const profileFields = [
  ['phone', 'Phone'], ['age', 'Age'], ['bloodGroup', 'Blood group'],
  ['emergencyContact', 'Emergency contact'], ['city', 'City'], ['bio', 'Health notes'],
];

const EMERGENCY_SYMPTOM_REGEX = /\b(chest pain|shortness of breath|breathing difficulty|difficulty breathing|can't breathe|cannot breathe|fainting|fainted|passed out|severe bleeding|heavy bleeding|stroke|face drooping|facial droop|slurred speech|one-sided weakness|seizure|seizures|unconscious|loss of consciousness)\b/i;
const AI_DISCLAIMER = 'This is not a medical diagnosis. Please consult a qualified doctor.';

const hasEmergencySymptoms = (text) => EMERGENCY_SYMPTOM_REGEX.test(text || '');

const makeAiMessage = (sender, payload) => ({
  id: `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
  sender,
  timestamp: new Date().toISOString(),
  ...payload,
});

function AiAssistantBubble({ message }) {
  const isPatient = message.sender === 'patient';

  return (
    <div className={`ai-chat-row ${isPatient ? 'ai-chat-row-user' : 'ai-chat-row-assistant'}`}>
      <div className={`ai-chat-bubble ${isPatient ? 'ai-chat-bubble-user' : 'ai-chat-bubble-assistant'}${message.emergency ? ' ai-chat-bubble-emergency' : ''}${message.error ? ' ai-chat-bubble-error' : ''}`}>
        {isPatient ? (
          <div>{message.text}</div>
        ) : message.emergency ? (
          <>
            <div className="ai-chat-emergency-title"><IcoAlert /> Emergency warning</div>
            <div>{message.text}</div>
          </>
        ) : message.error ? (
          <div>{message.text}</div>
        ) : (
          <div>{message.text}</div>
        )}
      </div>
    </div>
  );
}

export default function PatientDashboard() {
  const storedUser = getStoredUser();
  const [user, setUser] = useState(storedUser);
  const [appointments, setAppts] = useState([]);
  const [doctors, setDoctors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [apptForm, setApptForm] = useState({ doctorId: '', date: '', time: '', notes: '' });
  const [activeTab, setActiveTab] = useState('overview');
  const [aiInput, setAiInput] = useState('');
  // TODO: When MongoDB persistence is added, load and save this chat history via the backend.
  const [aiMessages, setAiMessages] = useState(() => [
    makeAiMessage('assistant', {
      reply: {
        summary: 'Describe your symptoms, what happened, duration, pain level, age, gender, and existing conditions.',
        urgency: 'low',
        recommendedSpecialist: 'General Physician',
        nextStep: 'Share what you are feeling so I can give safe general triage guidance.',
        disclaimer: AI_DISCLAIMER,
      },
    }),
  ]);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState('');
  const aiMessagesEndRef = useRef(null);
  const navigate = useNavigate();

  const role = 'patient';
  const cfg = ROLE_CFG.patient;
  const today = new Date().toISOString().split('T')[0];
  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
  const dateStr = new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });

  /* ── Fetch initial data from REST API ── */
  const fetchData = async () => {
    setLoading(true); setError('');
    try {
      const [meRes, apRes, docRes] = await Promise.all([
        api.get('/me'),
        api.get('/appointments'),
        api.get('/doctors'),
      ]);
      setUser(meRes.data.user);
      localStorage.setItem('hms_user', JSON.stringify(meRes.data.user));
      setAppts(apRes.data);
      setDoctors(docRes.data);
    } catch (err) { setError(getErrMsg(err, 'Could not load data.')); }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchData(); }, []);
  useEffect(() => { if (!success) return; const t = setTimeout(() => setSuccess(''), 4000); return () => clearTimeout(t); }, [success]);
  useEffect(() => { aiMessagesEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' }); }, [aiMessages, aiLoading]);

  /* ── Real-time Socket.IO sync ── */
  const handleAppointmentCreated = useCallback((appt) => {
    setAppts(prev => {
      if (prev.some(a => a.id === appt.id)) return prev;
      return [...prev, appt];
    });
    setSuccess(`New appointment with Dr. ${appt.doctorName || 'your doctor'}!`);
  }, []);

  const handleAppointmentUpdated = useCallback((appt) => {
    setAppts(prev => prev.map(a => a.id === appt.id ? appt : a));
    setSuccess(`Appointment ${appt.status}.`);
  }, []);

  useAppointmentSocket(user, handleAppointmentCreated, handleAppointmentUpdated);

  const logout = () => { localStorage.removeItem('hms_token'); localStorage.removeItem('hms_user'); navigate('/login'); };

  /* ── Derived data ── */
  const sortedAppts = useMemo(() =>
    [...appointments].sort((a, b) => new Date(`${a.date}T${a.time}`) - new Date(`${b.date}T${b.time}`)),
    [appointments]
  );
  const upcomingAppts = useMemo(() =>
    sortedAppts.filter(a => new Date(`${a.date}T${a.time}`) >= new Date() && a.status !== 'cancelled' && a.status !== 'completed'),
    [sortedAppts]
  );
  const pastAppts = useMemo(() =>
    sortedAppts.filter(a => new Date(`${a.date}T${a.time}`) < new Date() || a.status === 'completed' || a.status === 'cancelled'),
    [sortedAppts]
  );
  const nextAppt = useMemo(() => upcomingAppts[0] || null, [upcomingAppts]);

  const profilePct = useMemo(() => {
    const p = user.profile || {};
    const done = profileFields.filter(([k]) => String(p[k] || '').trim()).length;
    return Math.round(((done + (user.name ? 1 : 0)) / (profileFields.length + 1)) * 100);
  }, [user]);

  /* ── Book appointment ── */
  const bookAppt = async (e) => {
    e.preventDefault(); setError(''); setSuccess('');
    try {
      const res = await api.post('/appointments', apptForm);
      setAppts(prev => prev.some(a => a.id === res.data.id) ? prev : [...prev, res.data]);
      setSuccess('Appointment booked!');
      setApptForm({ doctorId: '', date: '', time: '', notes: '' });
    }
    catch (err) { setError(getErrMsg(err, 'Could not book appointment.')); }
  };

  const sendAiChat = async (e) => {
    e.preventDefault();
    const text = aiInput.trim();
    if (!text || aiLoading) return;

    const emergency = hasEmergencySymptoms(text);
    const outgoing = [
      makeAiMessage('patient', { text }),
    ];

    if (emergency) {
      outgoing.push(makeAiMessage('assistant', {
        emergency: true,
        text: 'These symptoms can be urgent. Call local emergency services or go to the nearest emergency department now, especially if symptoms are severe, sudden, or worsening.',
      }));
    }

    setAiMessages(prev => [...prev, ...outgoing]);
    setAiInput('');
    setAiError('');
    setAiLoading(true);

    try {
      // Build history payload
      // Use functional state updater to ensure we get the latest messages if needed,
      // but here we can just use the current `aiMessages` state + `outgoing`.
      const conversationHistory = [...aiMessages, ...outgoing]
        .filter(m => !m.error && !m.emergency) // exclude error messages and local emergency warnings from API context
        .slice(-10) // Keep the last 10 messages for context
        .map(m => ({
          role: m.sender === 'assistant' ? 'assistant' : 'user',
          content: m.text
        }));

      const res = await api.post('/api/ai-chat', { messages: conversationHistory }, { timeout: 30000 });
      setAiMessages(prev => [...prev, makeAiMessage('assistant', {
        text: res.data.reply || 'I could not process your message.',
      })]);
    } catch (err) {
      const msg = getErrMsg(err, 'AI assistant request failed. Please try again.');
      setAiError(msg);
      setAiMessages(prev => [...prev, makeAiMessage('assistant', {
        error: true,
        text: msg,
      })]);
    } finally {
      setAiLoading(false);
    }
  };

  const scrollTo = (id) => {
    setActiveTab(id);
    document.getElementById(`pt-${id}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const NAV = [
    { id: 'overview', label: 'Overview', icon: <IcoHome /> },
    { id: 'ai', label: 'AI Assistant', icon: <IcoActivity /> },
    { id: 'book', label: 'Book Visit', icon: <IcoPlus /> },
    { id: 'upcoming', label: 'Upcoming', icon: <IcoCalendar />, badge: upcomingAppts.length || null },
    { id: 'records', label: 'History', icon: <IcoFolder />, badge: pastAppts.length || null },
  ];

  const STATS = [
    { label: 'Total', value: appointments.length, note: 'All appointments', icon: <IcoCalendar />, color: '#0D9488', bg: 'rgba(13,148,136,0.1)' },
    { label: 'Upcoming', value: upcomingAppts.length, note: 'Scheduled visits', icon: <IcoClock />, color: '#10B981', bg: '#ECFDF5' },
    { label: 'Profile', value: `${profilePct}%`, note: 'Completion', icon: <IcoUser />, color: '#8B5CF6', bg: '#F5F3FF' },
    { label: 'Access', value: 'Patient', note: 'Current role', icon: <IcoShield />, color: '#F59E0B', bg: '#FFFBEB' },
  ];

  const nextDay = nextAppt ? new Date(nextAppt.date + 'T12:00').getDate() : null;
  const nextMon = nextAppt ? new Date(nextAppt.date + 'T12:00').toLocaleDateString('en-US', { month: 'short' }) : null;

  return (
    <>
      <Sidebar user={user} role={role} navItems={NAV} activeTab={activeTab} onNav={scrollTo} onLogout={logout} />
      <div className="dash2-workspace">
        <DashHeader role={role} error={error} success={success} onLogout={logout} />
        <div className="dash2-content">

          {/* ── GREETING ── */}
          <div id="pt-overview" style={{ scrollMarginTop: 80 }}>
            <div className="dash2-greeting">
              <div className="dash2-greeting-orb" /><div className="dash2-greeting-orb2" />
              <div style={{ position: 'relative', zIndex: 1 }}>
                <div className="dash2-greeting-hi">{greeting} 👋</div>
                <div className="dash2-greeting-name">{user.name?.split(' ')[0] || 'there'}</div>
                <div className="dash2-greeting-sub">{cfg.sub}</div>
                <div className="dash2-greeting-meta">
                  <div className="dash2-greeting-chip"><IcoCalendar />{dateStr}</div>
                  {nextAppt && <div className="dash2-greeting-chip"><IcoClock />Next: {nextAppt.date} at {nextAppt.time}</div>}
                </div>
              </div>
            </div>
          </div>

          {/* ── STATS ── */}
          <div className="dash2-stats">
            {STATS.map((s, i) => (
              <div key={s.label} className="dash2-stat-card" style={{ animationDelay: `${i * 0.07}s` }}>
                <div className="dash2-stat-top">
                  <div className="dash2-stat-icon" style={{ background: s.bg, color: s.color }}>{s.icon}</div>
                </div>
                <div className="dash2-stat-val">{loading ? '—' : s.value}</div>
                <div className="dash2-stat-label">{s.label}</div>
                <div className="dash2-stat-note">{s.note}</div>
              </div>
            ))}
          </div>

          {/* ── NEXT APPOINTMENT ── */}
          {!loading && nextAppt && (
            <div className="dash2-next-appt">
              <div className="dash2-next-date-block">
                <div className="dash2-next-date-day">{nextDay}</div>
                <div className="dash2-next-date-mon">{nextMon}</div>
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)', marginBottom: 2 }}>Upcoming Appointment</div>
                <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>
                  Dr. {nextAppt.doctorName || nextAppt.doctorId} · {nextAppt.time}
                  {nextAppt.notes && <span style={{ opacity: 0.7 }}> · {nextAppt.notes.slice(0, 40)}</span>}
                </div>
              </div>
              <StatusBadge status={nextAppt.status} />
            </div>
          )}

          {/* ── BOOK APPOINTMENT ── */}
          {/* AI HEALTH ASSISTANT */}
          <div id="pt-ai" style={{ scrollMarginTop: 80 }}>
            <SectionDivider title="AI Health Assistant" action="General triage guidance" />
            <div className="dash2-panel ai-chat-panel">
              <div className="dash2-panel-head">
                <div>
                  <div className="dash2-panel-title">Symptom Triage Chat</div>
                  <div className="dash2-panel-sub">Describe what happened in your own words. This assistant does not diagnose.</div>
                </div>
                <div className="ai-chat-head-icon"><IcoActivity /></div>
              </div>
              <div className="dash2-panel-body ai-chat-body">
                <div className="ai-chat-thread">
                  {aiMessages.map(msg => <AiAssistantBubble key={msg.id} message={msg} />)}
                  {aiLoading && (
                    <div className="ai-chat-row ai-chat-row-assistant">
                      <div className="ai-chat-bubble ai-chat-bubble-assistant ai-chat-loading">
                        <IcoSpin /> Reviewing symptoms...
                      </div>
                    </div>
                  )}
                  <div ref={aiMessagesEndRef} />
                </div>

                {hasEmergencySymptoms(aiInput) && (
                  <div className="ai-emergency-inline">
                    <IcoAlert />
                    <span>Emergency warning: these symptoms may need immediate care. Call emergency services or go to the nearest emergency department now.</span>
                  </div>
                )}
                {aiError && <div className="ai-chat-error"><IcoAlert />{aiError}</div>}

                <form className="ai-chat-form" onSubmit={sendAiChat}>
                  {/* TODO: With MongoDB persistence, submit can also include a conversationId returned by the backend. */}
                  <textarea
                    className="dash2-inp dash2-textarea ai-chat-input"
                    value={aiInput}
                    onChange={e => setAiInput(e.target.value)}
                    disabled={aiLoading}
                    rows={4}
                    placeholder="Example: I am 42, female, having fever and throat pain for 2 days, pain level 5/10, with asthma..."
                  />
                  <button type="submit" className="dash2-submit-btn ai-chat-send" disabled={!aiInput.trim() || aiLoading}>
                    {aiLoading ? <><IcoSpin /> Waiting for AI</> : 'Ask AI Assistant'}
                  </button>
                </form>
              </div>
            </div>
          </div>

          <div id="pt-book" style={{ scrollMarginTop: 80 }}>
            <SectionDivider title="Book Appointment" />
            <div className="dash2-panel">
              <div className="dash2-panel-head">
                <div>
                  <div className="dash2-panel-title">Schedule a Visit</div>
                  <div className="dash2-panel-sub">Select your doctor by name, pick a date &amp; time.</div>
                </div>
                <div style={{ color: 'var(--role-accent)' }}><IcoCalendar /></div>
              </div>
              <div className="dash2-panel-body">
                <form onSubmit={bookAppt} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                  <div className="dash2-fg"><label>Doctor</label>
                    {doctors.length > 0 ? (
                      <select
                        className="dash2-inp"
                        value={apptForm.doctorId}
                        onChange={e => setApptForm(p => ({ ...p, doctorId: e.target.value }))}
                        required
                        style={{ height: 40 }}
                      >
                        <option value="">— Select a doctor —</option>
                        {doctors.map(d => (
                          <option key={d.id} value={d.id}>
                            Dr. {d.name}{d.specialization ? ` — ${d.specialization}` : ''}{d.department ? ` (${d.department})` : ''}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <input className="dash2-inp" value={apptForm.doctorId}
                        onChange={e => setApptForm(p => ({ ...p, doctorId: e.target.value }))}
                        required placeholder="Doctor ID (no doctors found)"
                      />
                    )}
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                    <div className="dash2-fg"><label>Date</label>
                      <input className="dash2-inp" type="date" min={today} value={apptForm.date} onChange={e => setApptForm(p => ({ ...p, date: e.target.value }))} required />
                    </div>
                    <div className="dash2-fg"><label>Time</label>
                      <input className="dash2-inp" type="time" value={apptForm.time} onChange={e => setApptForm(p => ({ ...p, time: e.target.value }))} required />
                    </div>
                  </div>
                  <div className="dash2-fg"><label>Notes <span style={{ fontWeight: 400, color: 'var(--text-subtle)' }}>(optional)</span></label>
                    <textarea className="dash2-inp" rows={2} value={apptForm.notes} onChange={e => setApptForm(p => ({ ...p, notes: e.target.value }))} placeholder="Reason for visit, symptoms, etc." style={{ resize: 'vertical', minHeight: 44 }} />
                  </div>
                  <button type="submit" className="dash2-submit-btn">Book Appointment</button>
                </form>
              </div>
            </div>
          </div>

          {/* ── UPCOMING APPOINTMENTS ── */}
          <div id="pt-upcoming" style={{ scrollMarginTop: 80 }}>
            <SectionDivider title="Upcoming Appointments" action={`${upcomingAppts.length} scheduled`} />
            <div className="dash2-panel">
              <div className="dash2-panel-head">
                <div>
                  <div className="dash2-panel-title">Scheduled Visits</div>
                  <div className="dash2-panel-sub">Active, upcoming appointments</div>
                </div>
              </div>
              {loading ? (
                <div className="skeleton" style={{ height: 120, margin: 20, borderRadius: 'var(--r)' }} />
              ) : upcomingAppts.length > 0 ? (
                <div className="dash2-table-wrap">
                  <table className="dash2-table">
                    <thead><tr>{['#', 'Doctor', 'Date', 'Time', 'Status', 'Notes'].map(h => <th key={h}>{h}</th>)}</tr></thead>
                    <tbody>
                      {upcomingAppts.map(a => (
                        <tr key={a.id}>
                          <td style={{ color: 'var(--text-muted)', fontFamily: 'monospace', fontSize: 12 }}>#{a.id?.slice(-6)}</td>
                          <td style={{ fontWeight: 600 }}>Dr. {a.doctorName || a.doctorId}</td>
                          <td>{a.date}</td>
                          <td style={{ color: 'var(--text-muted)' }}>{a.time}</td>
                          <td><StatusBadge status={a.status} /></td>
                          <td style={{ color: 'var(--text-muted)', fontSize: 12, maxWidth: 140, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{a.notes || '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <EmptyState icon="📅" text="No upcoming appointments. Book one above!" />
              )}
            </div>
          </div>

          {/* ── PAST / ALL RECORDS ── */}
          <div id="pt-records" style={{ scrollMarginTop: 80 }}>
            <SectionDivider title="Appointment History" action={`${pastAppts.length} past`} />
            <div className="dash2-panel">
              <div className="dash2-panel-head">
                <div>
                  <div className="dash2-panel-title">Past Visits</div>
                  <div className="dash2-panel-sub">Completed and cancelled appointments</div>
                </div>
              </div>
              {loading ? (
                <div className="skeleton" style={{ height: 160, margin: 20, borderRadius: 'var(--r)' }} />
              ) : pastAppts.length > 0 ? (
                <div className="dash2-table-wrap">
                  <table className="dash2-table">
                    <thead><tr>{['#', 'Doctor', 'Date', 'Time', 'Status', 'Notes'].map(h => <th key={h}>{h}</th>)}</tr></thead>
                    <tbody>
                      {pastAppts.map(a => (
                        <tr key={a.id}>
                          <td style={{ color: 'var(--text-muted)', fontFamily: 'monospace', fontSize: 12 }}>#{a.id?.slice(-6)}</td>
                          <td style={{ fontWeight: 600 }}>Dr. {a.doctorName || a.doctorId}</td>
                          <td>{a.date}</td>
                          <td style={{ color: 'var(--text-muted)' }}>{a.time}</td>
                          <td><StatusBadge status={a.status} /></td>
                          <td style={{ color: 'var(--text-muted)', fontSize: 12, maxWidth: 140, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{a.notes || '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <EmptyState icon="🗓️" text="No past appointments yet." />
              )}
            </div>
          </div>

          <div style={{ height: 32 }} />
        </div>
      </div>
      <ChatWidget user={user} />
    </>
  );
}
