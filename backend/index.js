const express = require('express');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const http = require('http');
const { Server: SocketServer } = require('socket.io');
require('dotenv').config();
if (!process.env.GEMINI_API_KEY) {
  require('dotenv').config({ path: path.resolve(__dirname, '..', '.env') });
}

const app = express();
const server = http.createServer(app);

// Socket.IO — must be created early so route handlers can emit events
const io = new SocketServer(server, {
  cors: { origin: '*', methods: ['GET', 'POST'] },
});
const PORT = process.env.PORT || 5000;
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';
const ALLOWED_ROLES = new Set(['patient', 'doctor', 'admin']);
const PROFILE_FIELDS = new Set([
  'phone', 'city', 'age', 'bloodGroup', 'emergencyContact',
  'specialization', 'licenseNumber', 'department', 'availability',
  'adminTitle', 'organization', 'bio',
]);

app.use(cors());
app.use(express.json());

const dataFile = process.env.DATA_FILE
  ? path.resolve(process.env.DATA_FILE)
  : path.join(__dirname, 'data.json');

/* ── data helpers ── */
const readData = () => {
  if (!fs.existsSync(dataFile)) {
    return { users: [], appointments: [], patients: [], departments: [], organizations: [], auditLog: [] };
  }
  const raw = fs.readFileSync(dataFile, 'utf8').replace(/^\uFEFF/, '').trim();
  const data = raw ? JSON.parse(raw) : {};
  return {
    users: Array.isArray(data.users) ? data.users : [],
    appointments: Array.isArray(data.appointments) ? data.appointments : [],
    patients: Array.isArray(data.patients) ? data.patients : [],
    departments: Array.isArray(data.departments) ? data.departments : [],
    organizations: Array.isArray(data.organizations) ? data.organizations : [],
    auditLog: Array.isArray(data.auditLog) ? data.auditLog : [],
  };
};

const writeData = (data) => {
  fs.writeFileSync(dataFile, JSON.stringify(data, null, 2));
};

const publicUser = (user) => ({
  id: user.id,
  name: user.name,
  email: user.email,
  role: user.role,
  status: user.status || 'active',
  credentialStatus: user.credentialStatus || (user.role === 'doctor' ? 'pending' : undefined),
  profile: user.profile || {},
});

const cleanProfile = (profile = {}) => {
  return Object.entries(profile).reduce((acc, [key, value]) => {
    if (PROFILE_FIELDS.has(key)) {
      acc[key] = String(value || '').trim().slice(0, 500);
    }
    return acc;
  }, {});
};

/* helper: add audit entry */
const addAudit = (data, actorId, action, target = null) => {
  if (!data.auditLog) data.auditLog = [];
  data.auditLog.unshift({
    id: Date.now().toString(),
    actorId,
    action,
    target,
    timestamp: new Date().toISOString(),
  });
  // keep max 200 entries
  if (data.auditLog.length > 200) data.auditLog = data.auditLog.slice(0, 200);
};

/* ── auth middleware ── */
const authenticate = (req, res, next) => {
  const token = req.header('Authorization')?.replace('Bearer ', '');
  if (!token) return res.status(401).json({ message: 'Access denied' });
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch (err) {
    res.status(401).json({ message: 'Invalid token' });
  }
};

const requireRole = (...roles) => (req, res, next) => {
  if (!roles.includes(req.user.role)) {
    return res.status(403).json({ message: 'Access denied' });
  }
  next();
};

/* ═══════════════════════════
   AUTH
═══════════════════════════ */
app.post('/auth/signup', async (req, res) => {
  const name = String(req.body.name || '').trim();
  const email = String(req.body.email || '').trim().toLowerCase();
  const password = String(req.body.password || '');
  const role = ALLOWED_ROLES.has(req.body.role) ? req.body.role : 'patient';

  if (!name || !email || !password) {
    return res.status(400).json({ message: 'Name, email, and password are required' });
  }
  if (!email.includes('@')) {
    return res.status(400).json({ message: 'Please enter a valid email address' });
  }
  if (password.length < 6) {
    return res.status(400).json({ message: 'Password must be at least 6 characters' });
  }

  const data = readData();
  const existingUser = data.users.find(u => String(u.email).toLowerCase() === email);
  if (existingUser) {
    return res.status(409).json({ message: 'An account with this email already exists' });
  }

  const hashedPassword = await bcrypt.hash(password, 10);
  const user = {
    id: Date.now().toString(), name, email, password: hashedPassword, role,
    status: 'active',
    credentialStatus: role === 'doctor' ? 'pending' : undefined,
    profile: {},
  };
  data.users.push(user);
  addAudit(data, user.id, `New ${role} account created`, { userId: user.id, email });
  writeData(data);
  const token = jwt.sign({ id: user.id, email: user.email, role: user.role }, JWT_SECRET);
  res.json({ token, user: publicUser(user) });
});

app.post('/auth/login', async (req, res) => {
  const email = String(req.body.email || '').trim().toLowerCase();
  const password = String(req.body.password || '');

  if (!email || !password) {
    return res.status(400).json({ message: 'Email and password are required' });
  }
  const data = readData();
  const user = data.users.find(u => String(u.email).toLowerCase() === email);
  if (!user || !(await bcrypt.compare(password, user.password))) {
    return res.status(401).json({ message: 'Invalid credentials' });
  }
  if (user.status === 'suspended') {
    return res.status(403).json({ message: 'Your account has been suspended. Contact an administrator.' });
  }
  const token = jwt.sign({ id: user.id, email: user.email, role: user.role }, JWT_SECRET);
  res.json({ token, user: publicUser(user) });
});

/* ═══════════════════════════
   USER (self)
═══════════════════════════ */
app.get('/me', authenticate, (req, res) => {
  const data = readData();
  const user = data.users.find(u => u.id === req.user.id);
  if (!user) return res.status(404).json({ message: 'User not found' });
  res.json({ user: publicUser(user) });
});

app.put('/profile', authenticate, (req, res) => {
  const data = readData();
  const user = data.users.find(u => u.id === req.user.id);
  if (!user) return res.status(404).json({ message: 'User not found' });

  const name = String(req.body.name || '').trim();
  if (!name) return res.status(400).json({ message: 'Name is required' });

  user.name = name.slice(0, 120);
  user.profile = cleanProfile(req.body.profile);
  writeData(data);
  res.json({ user: publicUser(user) });
});

/* ═══════════════════════════
   APPOINTMENTS — Real-time synced
   ═══════════════════════════ */

// Helper: enrich appointment with doctor/patient names for the frontend
const enrichAppointment = (appt, data) => {
  const doc = data.users.find(u => u.id === appt.doctorId);
  const pat = data.users.find(u => u.id === appt.patientId);
  return {
    ...appt,
    doctorName: doc?.name || appt.doctorId,
    patientName: pat?.name || appt.patientId,
  };
};

app.get('/appointments', authenticate, (req, res) => {
  const data = readData();
  const raw = data.appointments.filter(
    a => a.patientId === req.user.id || a.doctorId === req.user.id || req.user.role === 'admin'
  );
  res.json(raw.map(a => enrichAppointment(a, data)));
});

app.post('/appointments', authenticate, (req, res) => {
  const { doctorId, patientId, date, time, notes, status = 'pending' } = req.body;
  if (!doctorId || !date || !time) {
    return res.status(400).json({ message: 'Doctor ID, date, and time are required' });
  }
  const data = readData();

  // Duplicate slot check: same doctor, same date+time, not cancelled
  const conflict = data.appointments.find(
    a => a.doctorId === doctorId && a.date === date && a.time === time && a.status !== 'cancelled'
  );
  if (conflict) {
    return res.status(409).json({ message: `This time slot is already booked for ${date} at ${time}.` });
  }

  // If a doctor creates the appointment, patientId comes from body; otherwise it's the logged-in user
  const resolvedPatientId = (req.user.role === 'doctor' || req.user.role === 'admin') && patientId
    ? patientId
    : req.user.id;

  const appointment = {
    id: Date.now().toString(),
    patientId: resolvedPatientId,
    doctorId,
    date,
    time,
    status,
    notes: (notes || '').trim().slice(0, 1000),
    createdBy: req.user.id,
    createdAt: new Date().toISOString(),
  };
  data.appointments.push(appointment);
  addAudit(data, req.user.id, 'Appointment created', { appointmentId: appointment.id, doctorId, date });
  writeData(data);

  const enriched = enrichAppointment(appointment, data);

  // Real-time: emit to both patient and doctor userId rooms
  io.to(`user_${appointment.patientId}`).emit('appointmentCreated', enriched);
  io.to(`user_${appointment.doctorId}`).emit('appointmentCreated', enriched);
  // Also notify admins
  data.users.filter(u => u.role === 'admin').forEach(a => {
    io.to(`user_${a.id}`).emit('appointmentCreated', enriched);
  });
  console.log(`[Appt] Created #${appointment.id} → emitted to user_${appointment.patientId} & user_${appointment.doctorId}`);

  res.json(enriched);
});

app.put('/appointments/:id/status', authenticate, requireRole('doctor', 'admin'), (req, res) => {
  const { status } = req.body;
  const allowed = ['pending', 'confirmed', 'completed', 'cancelled'];
  if (!allowed.includes(status)) {
    return res.status(400).json({ message: `Status must be one of: ${allowed.join(', ')}` });
  }
  const data = readData();
  const appt = data.appointments.find(a => a.id === req.params.id);
  if (!appt) return res.status(404).json({ message: 'Appointment not found' });
  const prevStatus = appt.status;
  appt.status = status;
  appt.updatedAt = new Date().toISOString();
  addAudit(data, req.user.id, `Appointment ${status}`, { appointmentId: appt.id });
  writeData(data);

  const enriched = enrichAppointment(appt, data);

  // Real-time: emit update to all involved parties
  io.to(`user_${appt.patientId}`).emit('appointmentUpdated', enriched);
  io.to(`user_${appt.doctorId}`).emit('appointmentUpdated', enriched);
  data.users.filter(u => u.role === 'admin').forEach(a => {
    io.to(`user_${a.id}`).emit('appointmentUpdated', enriched);
  });
  console.log(`[Appt] Updated #${appt.id} → ${status} — emitted to user_${appt.patientId} & user_${appt.doctorId}`);

  res.json(enriched);
});

/* ═══════════════════════════
   DOCTORS LIST (for patient booking)
   ═══════════════════════════ */
app.get('/doctors', authenticate, (req, res) => {
  const data = readData();
  const doctors = data.users
    .filter(u => u.role === 'doctor' && u.status !== 'suspended')
    .map(u => ({
      id: u.id,
      name: u.name,
      email: u.email,
      specialization: u.profile?.specialization || '',
      department: u.profile?.department || '',
    }));
  res.json(doctors);
});

/* ═══════════════════════════
   PATIENTS
═══════════════════════════ */
app.get('/patients', authenticate, (req, res) => {
  if (req.user.role !== 'doctor' && req.user.role !== 'admin') {
    return res.status(403).json({ message: 'Access denied' });
  }
  const data = readData();
  res.json(data.patients);
});

app.post('/patients', authenticate, (req, res) => {
  if (req.user.role !== 'doctor' && req.user.role !== 'admin') {
    return res.status(403).json({ message: 'Access denied' });
  }
  const { name, age, contact } = req.body;
  if (!name || !age || !contact) {
    return res.status(400).json({ message: 'Name, age, and contact are required' });
  }
  const data = readData();
  const patient = { id: Date.now().toString(), name, age, contact };
  data.patients.push(patient);
  addAudit(data, req.user.id, 'Patient registered', { patientId: patient.id, name });
  writeData(data);
  res.json(patient);
});

/* ═══════════════════════════
   ADMIN: USER MANAGEMENT
═══════════════════════════ */
app.get('/users', authenticate, requireRole('admin'), (req, res) => {
  const data = readData();
  res.json(data.users.map(publicUser));
});

app.put('/users/:id/role', authenticate, requireRole('admin'), (req, res) => {
  const { role } = req.body;
  if (!ALLOWED_ROLES.has(role)) {
    return res.status(400).json({ message: 'Invalid role' });
  }
  const data = readData();
  const user = data.users.find(u => u.id === req.params.id);
  if (!user) return res.status(404).json({ message: 'User not found' });
  if (user.id === req.user.id) return res.status(400).json({ message: 'Cannot change your own role' });
  const old = user.role;
  user.role = role;
  if (role === 'doctor' && !user.credentialStatus) user.credentialStatus = 'pending';
  addAudit(data, req.user.id, `Changed role ${old} → ${role}`, { userId: user.id, email: user.email });
  writeData(data);
  res.json(publicUser(user));
});

app.put('/users/:id/status', authenticate, requireRole('admin'), (req, res) => {
  const { status } = req.body;
  if (!['active', 'suspended'].includes(status)) {
    return res.status(400).json({ message: 'Status must be active or suspended' });
  }
  const data = readData();
  const user = data.users.find(u => u.id === req.params.id);
  if (!user) return res.status(404).json({ message: 'User not found' });
  if (user.id === req.user.id) return res.status(400).json({ message: 'Cannot change your own status' });
  user.status = status;
  addAudit(data, req.user.id, `User ${status}`, { userId: user.id, email: user.email });
  writeData(data);
  res.json(publicUser(user));
});

app.put('/users/:id/verify', authenticate, requireRole('admin'), (req, res) => {
  const { credentialStatus } = req.body;
  if (!['pending', 'verified', 'rejected'].includes(credentialStatus)) {
    return res.status(400).json({ message: 'credentialStatus must be pending, verified, or rejected' });
  }
  const data = readData();
  const user = data.users.find(u => u.id === req.params.id);
  if (!user) return res.status(404).json({ message: 'User not found' });
  if (user.role !== 'doctor') return res.status(400).json({ message: 'Only doctors have credentials to verify' });
  user.credentialStatus = credentialStatus;
  addAudit(data, req.user.id, `Doctor credentials ${credentialStatus}`, { userId: user.id, email: user.email });
  writeData(data);
  res.json(publicUser(user));
});

/* ═══════════════════════════
   ADMIN: DEPARTMENTS
═══════════════════════════ */
app.get('/departments', authenticate, (req, res) => {
  const data = readData();
  res.json(data.departments || []);
});

app.post('/departments', authenticate, requireRole('admin'), (req, res) => {
  const name = String(req.body.name || '').trim();
  const head = String(req.body.head || '').trim();
  if (!name) return res.status(400).json({ message: 'Department name is required' });
  const data = readData();
  if (!data.departments) data.departments = [];
  const dept = { id: Date.now().toString(), name, head, createdAt: new Date().toISOString() };
  data.departments.push(dept);
  addAudit(data, req.user.id, 'Department created', { deptId: dept.id, name });
  writeData(data);
  res.json(dept);
});

app.delete('/departments/:id', authenticate, requireRole('admin'), (req, res) => {
  const data = readData();
  const idx = (data.departments || []).findIndex(d => d.id === req.params.id);
  if (idx === -1) return res.status(404).json({ message: 'Department not found' });
  const removed = data.departments.splice(idx, 1)[0];
  addAudit(data, req.user.id, 'Department deleted', { deptId: removed.id, name: removed.name });
  writeData(data);
  res.json({ message: 'Deleted' });
});

/* ═══════════════════════════
   ADMIN: ORGANIZATIONS
═══════════════════════════ */
app.get('/organizations', authenticate, (req, res) => {
  const data = readData();
  res.json(data.organizations || []);
});

app.post('/organizations', authenticate, requireRole('admin'), (req, res) => {
  const name = String(req.body.name || '').trim();
  const type = String(req.body.type || 'clinic').trim();
  const city = String(req.body.city || '').trim();
  if (!name) return res.status(400).json({ message: 'Organization name is required' });
  const data = readData();
  if (!data.organizations) data.organizations = [];
  const org = { id: Date.now().toString(), name, type, city, createdAt: new Date().toISOString() };
  data.organizations.push(org);
  addAudit(data, req.user.id, 'Organization created', { orgId: org.id, name });
  writeData(data);
  res.json(org);
});

app.delete('/organizations/:id', authenticate, requireRole('admin'), (req, res) => {
  const data = readData();
  const idx = (data.organizations || []).findIndex(o => o.id === req.params.id);
  if (idx === -1) return res.status(404).json({ message: 'Organization not found' });
  const removed = data.organizations.splice(idx, 1)[0];
  addAudit(data, req.user.id, 'Organization deleted', { orgId: removed.id, name: removed.name });
  writeData(data);
  res.json({ message: 'Deleted' });
});

/* ═══════════════════════════
   ADMIN: AUDIT LOG
═══════════════════════════ */
app.get('/audit-log', authenticate, requireRole('admin'), (req, res) => {
  const data = readData();
  // enrich with actor names
  const log = (data.auditLog || []).map(entry => {
    const actor = data.users.find(u => u.id === entry.actorId);
    return { ...entry, actorName: actor?.name || 'System', actorRole: actor?.role || 'unknown' };
  });
  res.json(log.slice(0, 100));
});

/* ═══════════════════════════
   CHAT — In-memory message store
   TODO: Replace with database persistence (MongoDB, Postgres, etc.)
   ═══════════════════════════ */

app.post('/api/ai-chat', authenticate, requireRole('patient'), async (req, res) => {
  const messages = req.body.messages;
  
  if (!messages || !Array.isArray(messages) || messages.length === 0) {
    return res.status(400).json({ message: 'Please provide a valid conversation history.' });
  }

  if (!process.env.GEMINI_API_KEY) {
    return res.status(500).json({ message: 'AI assistant is not configured on the server.' });
  }

  const systemPrompt = `You are a conversational AI health assistant inside a healthcare app.

Use the full conversation history to understand context.

Rules:
- Do not diagnose.
- Do not repeat questions already answered.
- Give practical, simple, and useful guidance detailing potential symptoms, how to alleviate them, and ALWAYS advise visiting a doctor at the end.
- Ask follow-up questions only if necessary.
- Keep responses short, natural, and human-like.
- Avoid rigid or robotic language.
- Suggest seeing a doctor if symptoms are prolonged, severe, or unclear.
- For emergencies (chest pain, breathing difficulty, fainting, seizures, stroke-like symptoms, severe bleeding, unconsciousness), tell the user to seek immediate medical care.
- Use disclaimers sparingly, not in every message.`;

  // Build the message payload for Gemini
  // Gemini expects: { role: 'user' | 'model', parts: [{ text: '...' }] }
  const geminiMessages = messages.map(msg => ({
    role: msg.role === 'assistant' ? 'model' : 'user',
    parts: [{ text: String(msg.content || '').trim().slice(0, 3000) }]
  }));

  try {
    const geminiRes = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${process.env.GEMINI_API_KEY}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: systemPrompt }] },
        contents: geminiMessages,
        generationConfig: {
          temperature: 0.2,
          maxOutputTokens: 500,
        }
      }),
    });

    if (!geminiRes.ok) {
      const body = await geminiRes.text();
      console.error('[AI Chat] Gemini API error:', geminiRes.status, body.slice(0, 500));
      return res.status(502).json({ message: 'AI assistant could not respond right now.' });
    }

    const data = await geminiRes.json();
    const reply = data?.candidates?.[0]?.content?.parts?.[0]?.text || 'I could not process your message.';

    // TODO: Add MongoDB persistence here later for the conversational reply.
    res.json({ reply });
  } catch (err) {
    console.error('[AI Chat] Request failed:', err.message);
    res.status(502).json({ message: 'AI assistant request failed. Please try again.' });
  }
});

// In-memory store: { [conversationId]: [ { id, conversationId, senderId, senderName, senderRole, text, timestamp } ] }
// TODO: When adding a database, replace this Map with DB queries.
const chatStore = new Map();

function getChatMessages(conversationId) {
  // TODO: Replace with DB query — e.g. Message.find({ conversationId }).sort({ timestamp: 1 })
  return chatStore.get(conversationId) || [];
}

function saveChatMessage(msg) {
  // TODO: Replace with DB insert — e.g. await Message.create(msg)
  if (!chatStore.has(msg.conversationId)) chatStore.set(msg.conversationId, []);
  chatStore.get(msg.conversationId).push(msg);
  // Cap at 500 messages per conversation in memory
  const arr = chatStore.get(msg.conversationId);
  if (arr.length > 500) chatStore.set(msg.conversationId, arr.slice(-500));
}

// REST endpoint: fetch chat history for a conversation
app.get('/chat/:conversationId', authenticate, (req, res) => {
  // TODO: Add authorization check — ensure user is a participant of this conversation
  const messages = getChatMessages(req.params.conversationId);
  res.json(messages);
});

// REST endpoint: list conversations for current user
app.get('/conversations', authenticate, (req, res) => {
  // TODO: Replace with DB query when persistence is added
  const userId = req.user.id;
  const convos = [];
  for (const [convId, msgs] of chatStore.entries()) {
    const userMsgs = msgs.filter(m => m.senderId === userId || m.recipientId === userId);
    if (userMsgs.length > 0) {
      const last = msgs[msgs.length - 1];
      convos.push({ conversationId: convId, lastMessage: last, messageCount: msgs.length });
    }
  }
  res.json(convos);
});

/* ═══════════════════════════
   SOCKET.IO CONNECTION HANDLERS
   (io is created at top of file)
   ═══════════════════════════ */

// Authenticate socket connections via JWT
io.use((socket, next) => {
  const token = socket.handshake.auth?.token;
  if (!token) return next(new Error('Authentication required'));
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    socket.user = decoded;
    // Enrich with full user data
    const data = readData();
    const fullUser = data.users.find(u => u.id === decoded.id);
    if (fullUser) {
      socket.user.name = fullUser.name;
      socket.user.role = fullUser.role;
    }
    next();
  } catch (err) {
    next(new Error('Invalid token'));
  }
});

io.on('connection', (socket) => {
  console.log(`[Socket] ${socket.user.name} (${socket.user.role}) connected`);

  // Auto-join user's personal room for appointment events
  const userRoom = `user_${socket.user.id}`;
  socket.join(userRoom);
  console.log(`[Socket] ${socket.user.name} auto-joined room: ${userRoom}`);

  // Join a conversation room (chat)
  socket.on('join_conversation', (conversationId) => {
    socket.join(conversationId);
    console.log(`[Socket] ${socket.user.name} joined room: ${conversationId}`);
  });

  // Leave a conversation room
  socket.on('leave_conversation', (conversationId) => {
    socket.leave(conversationId);
  });

  // Send a message
  socket.on('send_message', ({ conversationId, text, recipientId }) => {
    if (!conversationId || !text?.trim()) return;

    const message = {
      id: Date.now().toString() + '_' + Math.random().toString(36).slice(2, 8),
      conversationId,
      senderId: socket.user.id,
      senderName: socket.user.name || 'User',
      senderRole: socket.user.role || 'patient',
      recipientId: recipientId || null,
      text: text.trim().slice(0, 2000),
      timestamp: new Date().toISOString(),
    };

    // TODO: Replace saveChatMessage with a database write
    saveChatMessage(message);

    // Broadcast to everyone in the room (including sender)
    io.to(conversationId).emit('new_message', message);
  });

  // Typing indicator
  socket.on('typing', ({ conversationId }) => {
    socket.to(conversationId).emit('user_typing', {
      userId: socket.user.id,
      userName: socket.user.name,
    });
  });

  socket.on('stop_typing', ({ conversationId }) => {
    socket.to(conversationId).emit('user_stop_typing', {
      userId: socket.user.id,
    });
  });

  socket.on('disconnect', () => {
    console.log(`[Socket] ${socket.user.name} disconnected`);
  });
});

/* ═══════════════════════════ */
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT} (HTTP + WebSocket)`);
});

server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`\n❌ Port ${PORT} is already in use.`);
    console.error(`   Run this to fix it: npx kill-port ${PORT}`);
    console.error(`   Then run npm start again.\n`);
    process.exit(1);
  } else {
    throw err;
  }
});
