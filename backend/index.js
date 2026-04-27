const express = require('express');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const cors = require('cors');
const mongoose = require('mongoose');
const path = require('path');
const http = require('http');
const { Server: SocketServer } = require('socket.io');
require('dotenv').config();
if (!process.env.GEMINI_API_KEY) {
  require('dotenv').config({ path: path.resolve(__dirname, '..', '.env') });
}

/* ── Mongoose Models ── */
const User = require('./models/User');
const Appointment = require('./models/Appointment');
const Patient = require('./models/Patient');
const Department = require('./models/Department');
const Organization = require('./models/Organization');
const AuditLog = require('./models/AuditLog');
const Message = require('./models/Message');

const app = express();
app.use(cors({
  origin: [
    "http://localhost:5173",
    "https://major-project-zeta-two.vercel.app"
  ],
  credentials: true
}));
const server = http.createServer(app);

const io = new SocketServer(server, {
  cors: {
    origin: [
      "http://localhost:5173",
      "https://major-project-zeta-two.vercel.app"
    ],
    methods: ["GET", "POST"],
    credentials: true
  }
});
const PORT = process.env.PORT || 5000;
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';
const ALLOWED_ROLES = new Set(['patient', 'doctor', 'admin']);
const PROFILE_FIELDS = new Set([
  'phone', 'city', 'age', 'bloodGroup', 'emergencyContact',
  'specialization', 'licenseNumber', 'department', 'availability',
  'adminTitle', 'organization', 'bio',
]);

app.use(express.json());

/* ── MongoDB Connection ── */
mongoose.connect(process.env.MONGODB_URI)
  .then(() => console.log('✅ Connected to MongoDB'))
  .catch((err) => {
    console.error('❌ MongoDB connection error:', err.message);
    process.exit(1);
  });

/* ── helpers ── */
const publicUser = (user) => ({
  id: user._id?.toString() || user.id,
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

const addAudit = async (actorId, action, target = null) => {
  try {
    await AuditLog.create({ actorId, action, target });
    // Keep max 200 entries
    const count = await AuditLog.countDocuments();
    if (count > 200) {
      const oldest = await AuditLog.find().sort({ createdAt: 1 }).limit(count - 200);
      const ids = oldest.map(e => e._id);
      await AuditLog.deleteMany({ _id: { $in: ids } });
    }
  } catch (err) {
    console.error('[AuditLog] Error:', err.message);
  }
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

  try {
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(409).json({ message: 'An account with this email already exists' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const user = await User.create({
      name, email, password: hashedPassword, role,
      status: 'active',
      credentialStatus: role === 'doctor' ? 'pending' : undefined,
      profile: {},
    });

    await addAudit(user._id.toString(), `New ${role} account created`, { userId: user._id.toString(), email });
    const token = jwt.sign({ id: user._id.toString(), email: user.email, role: user.role }, JWT_SECRET);
    res.json({ token, user: publicUser(user) });
  } catch (err) {
    console.error('[Signup] Error:', err.message);
    res.status(500).json({ message: 'Server error during signup' });
  }
});

app.post('/auth/login', async (req, res) => {
  const email = String(req.body.email || '').trim().toLowerCase();
  const password = String(req.body.password || '');

  if (!email || !password) {
    return res.status(400).json({ message: 'Email and password are required' });
  }
  try {
    const user = await User.findOne({ email });
    if (!user || !(await bcrypt.compare(password, user.password))) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }
    if (user.status === 'suspended') {
      return res.status(403).json({ message: 'Your account has been suspended. Contact an administrator.' });
    }
    const token = jwt.sign({ id: user._id.toString(), email: user.email, role: user.role }, JWT_SECRET);
    res.json({ token, user: publicUser(user) });
  } catch (err) {
    console.error('[Login] Error:', err.message);
    res.status(500).json({ message: 'Server error during login' });
  }
});

/* ═══════════════════════════
   USER (self)
═══════════════════════════ */
app.get('/me', authenticate, async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ message: 'User not found' });
    res.json({ user: publicUser(user) });
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

app.put('/profile', authenticate, async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ message: 'User not found' });

    const name = String(req.body.name || '').trim();
    if (!name) return res.status(400).json({ message: 'Name is required' });

    user.name = name.slice(0, 120);
    user.profile = cleanProfile(req.body.profile);
    await user.save();
    res.json({ user: publicUser(user) });
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

/* ═══════════════════════════
   APPOINTMENTS
═══════════════════════════ */
const enrichAppointment = async (appt) => {
  const doc = await User.findById(appt.doctorId);
  const pat = await User.findById(appt.patientId);
  const obj = appt.toJSON ? appt.toJSON() : appt;
  return {
    ...obj,
    doctorName: doc?.name || appt.doctorId,
    patientName: pat?.name || appt.patientId,
  };
};

app.get('/appointments', authenticate, async (req, res) => {
  try {
    const filter = req.user.role === 'admin'
      ? {}
      : { $or: [{ patientId: req.user.id }, { doctorId: req.user.id }] };
    const raw = await Appointment.find(filter).sort({ date: 1, time: 1 });
    const enriched = await Promise.all(raw.map(a => enrichAppointment(a)));
    res.json(enriched);
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

app.post('/appointments', authenticate, async (req, res) => {
  const { doctorId, patientId, date, time, notes, status = 'pending' } = req.body;
  if (!doctorId || !date || !time) {
    return res.status(400).json({ message: 'Doctor ID, date, and time are required' });
  }
  try {
    const conflict = await Appointment.findOne({
      doctorId, date, time, status: { $ne: 'cancelled' }
    });
    if (conflict) {
      return res.status(409).json({ message: `This time slot is already booked for ${date} at ${time}.` });
    }

    const resolvedPatientId = (req.user.role === 'doctor' || req.user.role === 'admin') && patientId
      ? patientId : req.user.id;

    const appointment = await Appointment.create({
      patientId: resolvedPatientId, doctorId, date, time, status,
      notes: (notes || '').trim().slice(0, 1000),
      createdBy: req.user.id,
    });

    await addAudit(req.user.id, 'Appointment created', { appointmentId: appointment._id.toString(), doctorId, date });
    const enriched = await enrichAppointment(appointment);

    io.to(`user_${appointment.patientId}`).emit('appointmentCreated', enriched);
    io.to(`user_${appointment.doctorId}`).emit('appointmentCreated', enriched);
    const admins = await User.find({ role: 'admin' });
    admins.forEach(a => io.to(`user_${a._id.toString()}`).emit('appointmentCreated', enriched));

    res.json(enriched);
  } catch (err) {
    console.error('[Appointment] Error:', err.message);
    res.status(500).json({ message: 'Server error' });
  }
});

app.put('/appointments/:id/status', authenticate, requireRole('doctor', 'admin'), async (req, res) => {
  const { status } = req.body;
  const allowed = ['pending', 'confirmed', 'completed', 'cancelled'];
  if (!allowed.includes(status)) {
    return res.status(400).json({ message: `Status must be one of: ${allowed.join(', ')}` });
  }
  try {
    const appt = await Appointment.findById(req.params.id);
    if (!appt) return res.status(404).json({ message: 'Appointment not found' });
    appt.status = status;
    await appt.save();
    await addAudit(req.user.id, `Appointment ${status}`, { appointmentId: appt._id.toString() });
    const enriched = await enrichAppointment(appt);

    io.to(`user_${appt.patientId}`).emit('appointmentUpdated', enriched);
    io.to(`user_${appt.doctorId}`).emit('appointmentUpdated', enriched);
    const admins = await User.find({ role: 'admin' });
    admins.forEach(a => io.to(`user_${a._id.toString()}`).emit('appointmentUpdated', enriched));

    res.json(enriched);
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

/* ═══════════════════════════
   DOCTORS LIST
═══════════════════════════ */
app.get('/doctors', authenticate, async (req, res) => {
  try {
    const doctors = await User.find({ role: 'doctor', status: { $ne: 'suspended' } });
    res.json(doctors.map(u => ({
      id: u._id.toString(),
      name: u.name,
      email: u.email,
      specialization: u.profile?.specialization || '',
      department: u.profile?.department || '',
    })));
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

/* ═══════════════════════════
   PATIENTS
═══════════════════════════ */
app.get('/patients', authenticate, async (req, res) => {
  if (req.user.role !== 'doctor' && req.user.role !== 'admin') {
    return res.status(403).json({ message: 'Access denied' });
  }
  try {
    const patients = await Patient.find();
    res.json(patients);
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

app.post('/patients', authenticate, async (req, res) => {
  if (req.user.role !== 'doctor' && req.user.role !== 'admin') {
    return res.status(403).json({ message: 'Access denied' });
  }
  const { name, age, contact } = req.body;
  if (!name || !age || !contact) {
    return res.status(400).json({ message: 'Name, age, and contact are required' });
  }
  try {
    const patient = await Patient.create({ name, age, contact });
    await addAudit(req.user.id, 'Patient registered', { patientId: patient._id.toString(), name });
    res.json(patient);
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

/* ═══════════════════════════
   ADMIN: USER MANAGEMENT
═══════════════════════════ */
app.get('/users', authenticate, requireRole('admin'), async (req, res) => {
  try {
    const users = await User.find();
    res.json(users.map(publicUser));
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

app.put('/users/:id/role', authenticate, requireRole('admin'), async (req, res) => {
  const { role } = req.body;
  if (!ALLOWED_ROLES.has(role)) {
    return res.status(400).json({ message: 'Invalid role' });
  }
  try {
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ message: 'User not found' });
    if (user._id.toString() === req.user.id) return res.status(400).json({ message: 'Cannot change your own role' });
    const old = user.role;
    user.role = role;
    if (role === 'doctor' && !user.credentialStatus) user.credentialStatus = 'pending';
    await user.save();
    await addAudit(req.user.id, `Changed role ${old} → ${role}`, { userId: user._id.toString(), email: user.email });
    res.json(publicUser(user));
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

app.put('/users/:id/status', authenticate, requireRole('admin'), async (req, res) => {
  const { status } = req.body;
  if (!['active', 'suspended'].includes(status)) {
    return res.status(400).json({ message: 'Status must be active or suspended' });
  }
  try {
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ message: 'User not found' });
    if (user._id.toString() === req.user.id) return res.status(400).json({ message: 'Cannot change your own status' });
    user.status = status;
    await user.save();
    await addAudit(req.user.id, `User ${status}`, { userId: user._id.toString(), email: user.email });
    res.json(publicUser(user));
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

app.put('/users/:id/verify', authenticate, requireRole('admin'), async (req, res) => {
  const { credentialStatus } = req.body;
  if (!['pending', 'verified', 'rejected'].includes(credentialStatus)) {
    return res.status(400).json({ message: 'credentialStatus must be pending, verified, or rejected' });
  }
  try {
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ message: 'User not found' });
    if (user.role !== 'doctor') return res.status(400).json({ message: 'Only doctors have credentials to verify' });
    user.credentialStatus = credentialStatus;
    await user.save();
    await addAudit(req.user.id, `Doctor credentials ${credentialStatus}`, { userId: user._id.toString(), email: user.email });
    res.json(publicUser(user));
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

/* ═══════════════════════════
   ADMIN: DEPARTMENTS
═══════════════════════════ */
app.get('/departments', authenticate, async (req, res) => {
  try {
    const departments = await Department.find();
    res.json(departments);
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

app.post('/departments', authenticate, requireRole('admin'), async (req, res) => {
  const name = String(req.body.name || '').trim();
  const head = String(req.body.head || '').trim();
  if (!name) return res.status(400).json({ message: 'Department name is required' });
  try {
    const dept = await Department.create({ name, head });
    await addAudit(req.user.id, 'Department created', { deptId: dept._id.toString(), name });
    res.json(dept);
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

app.delete('/departments/:id', authenticate, requireRole('admin'), async (req, res) => {
  try {
    const removed = await Department.findByIdAndDelete(req.params.id);
    if (!removed) return res.status(404).json({ message: 'Department not found' });
    await addAudit(req.user.id, 'Department deleted', { deptId: removed._id.toString(), name: removed.name });
    res.json({ message: 'Deleted' });
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

/* ═══════════════════════════
   ADMIN: ORGANIZATIONS
═══════════════════════════ */
app.get('/organizations', authenticate, async (req, res) => {
  try {
    const organizations = await Organization.find();
    res.json(organizations);
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

app.post('/organizations', authenticate, requireRole('admin'), async (req, res) => {
  const name = String(req.body.name || '').trim();
  const type = String(req.body.type || 'clinic').trim();
  const city = String(req.body.city || '').trim();
  if (!name) return res.status(400).json({ message: 'Organization name is required' });
  try {
    const org = await Organization.create({ name, type, city });
    await addAudit(req.user.id, 'Organization created', { orgId: org._id.toString(), name });
    res.json(org);
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

app.delete('/organizations/:id', authenticate, requireRole('admin'), async (req, res) => {
  try {
    const removed = await Organization.findByIdAndDelete(req.params.id);
    if (!removed) return res.status(404).json({ message: 'Organization not found' });
    await addAudit(req.user.id, 'Organization deleted', { orgId: removed._id.toString(), name: removed.name });
    res.json({ message: 'Deleted' });
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

/* ═══════════════════════════
   ADMIN: AUDIT LOG
═══════════════════════════ */
app.get('/audit-log', authenticate, requireRole('admin'), async (req, res) => {
  try {
    const logs = await AuditLog.find().sort({ createdAt: -1 }).limit(100);
    const enriched = await Promise.all(logs.map(async (entry) => {
      const actor = await User.findById(entry.actorId);
      return {
        ...entry.toJSON(),
        actorName: actor?.name || 'System',
        actorRole: actor?.role || 'unknown',
      };
    }));
    res.json(enriched);
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

/* ═══════════════════════════
   AI CHAT
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

  const geminiMessages = messages.map(msg => ({
    role: msg.role === 'assistant' ? 'model' : 'user',
    parts: [{ text: String(msg.content || '').trim().slice(0, 3000) }]
  }));

  try {
    const geminiRes = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${process.env.GEMINI_API_KEY}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: systemPrompt }] },
        contents: geminiMessages,
        generationConfig: { temperature: 0.2, maxOutputTokens: 500 },
      }),
    });

    if (!geminiRes.ok) {
      const body = await geminiRes.text();
      console.error('[AI Chat] Gemini API error:', geminiRes.status, body.slice(0, 500));
      return res.status(502).json({ message: 'AI assistant could not respond right now.' });
    }

    const data = await geminiRes.json();
    const reply = data?.candidates?.[0]?.content?.parts?.[0]?.text || 'I could not process your message.';
    res.json({ reply });
  } catch (err) {
    console.error('[AI Chat] Request failed:', err.message);
    res.status(502).json({ message: 'AI assistant request failed. Please try again.' });
  }
});

/* ═══════════════════════════
   CHAT — MongoDB persistent store
═══════════════════════════ */
app.get('/chat/:conversationId', authenticate, async (req, res) => {
  try {
    const messages = await Message.find({ conversationId: req.params.conversationId }).sort({ createdAt: 1 });
    res.json(messages);
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

app.get('/conversations', authenticate, async (req, res) => {
  try {
    const userId = req.user.id;
    const userMessages = await Message.find({
      $or: [{ senderId: userId }, { recipientId: userId }]
    });

    const convMap = new Map();
    userMessages.forEach(msg => {
      const cid = msg.conversationId;
      if (!convMap.has(cid)) {
        convMap.set(cid, { conversationId: cid, lastMessage: msg, messageCount: 0 });
      }
      const entry = convMap.get(cid);
      entry.messageCount++;
      if (new Date(msg.createdAt) > new Date(entry.lastMessage.createdAt)) {
        entry.lastMessage = msg;
      }
    });

    res.json(Array.from(convMap.values()));
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

/* ═══════════════════════════
   SOCKET.IO
═══════════════════════════ */
io.use(async (socket, next) => {
  const token = socket.handshake.auth?.token;
  if (!token) return next(new Error('Authentication required'));
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    socket.user = decoded;
    const fullUser = await User.findById(decoded.id);
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
  const userRoom = `user_${socket.user.id}`;
  socket.join(userRoom);
  console.log(`[Socket] ${socket.user.name} auto-joined room: ${userRoom}`);

  socket.on('join_conversation', (conversationId) => {
    socket.join(conversationId);
    console.log(`[Socket] ${socket.user.name} joined room: ${conversationId}`);
  });

  socket.on('leave_conversation', (conversationId) => {
    socket.leave(conversationId);
  });

  socket.on('send_message', async ({ conversationId, text, recipientId }) => {
    if (!conversationId || !text?.trim()) return;

    try {
      const message = await Message.create({
        conversationId,
        senderId: socket.user.id,
        senderName: socket.user.name || 'User',
        senderRole: socket.user.role || 'patient',
        recipientId: recipientId || null,
        text: text.trim().slice(0, 2000),
      });

      io.to(conversationId).emit('new_message', message.toJSON());
    } catch (err) {
      console.error('[Socket] Error saving message:', err.message);
    }
  });

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
