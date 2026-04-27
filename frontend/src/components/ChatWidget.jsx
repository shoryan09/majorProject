import { useEffect, useRef, useState, useCallback } from 'react';
import { io } from 'socket.io-client';
import api from '../services/api';

const API_URL = import.meta.env.VITE_API_URL || 'http://127.0.0.1:5000';

/* ── icons ── */
const ChatIcon = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
  </svg>
);
const CloseIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M18 6 6 18M6 6l12 12"/></svg>
);
const SendIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/>
  </svg>
);
const BackIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="m15 18-6-6 6-6"/></svg>
);

/* ── time formatter ── */
function fmtTime(ts) {
  const d = new Date(ts);
  return d.toLocaleTimeString('en-US', { hour:'2-digit', minute:'2-digit' });
}
function fmtDate(ts) {
  const d = new Date(ts);
  const today = new Date();
  if (d.toDateString() === today.toDateString()) return 'Today';
  const yesterday = new Date(today); yesterday.setDate(today.getDate() - 1);
  if (d.toDateString() === yesterday.toDateString()) return 'Yesterday';
  return d.toLocaleDateString('en-US', { month:'short', day:'numeric' });
}

/**
 * ChatWidget — Floating chat panel for Doctor ↔ Patient messaging.
 *
 * Props:
 *   user    — { id, name, role, ... }
 *   role    — 'patient' | 'doctor'
 */
export default function ChatWidget({ user }) {
  const [open, setOpen]             = useState(false);
  const [socket, setSocket]         = useState(null);
  const [messages, setMessages]     = useState([]);
  const [input, setInput]           = useState('');
  const [conversationId, setConvId] = useState('');
  const [convInput, setConvInput]   = useState('');
  const [convList, setConvList]     = useState([]);
  const [inChat, setInChat]         = useState(false);
  const [typing, setTyping]         = useState(null);
  const [unread, setUnread]         = useState(0);
  const messagesEndRef = useRef(null);
  const typingTimeout  = useRef(null);

  const role = user?.role || 'patient';

  /* ── connect socket on mount ── */
  useEffect(() => {
    const token = localStorage.getItem('hms_token');
    if (!token) return;

    const s = io(API_URL, {
      auth: { token },
      transports: ['websocket', 'polling'],
    });

    s.on('connect', () => console.log('[Chat] Connected'));
    s.on('connect_error', (err) => console.warn('[Chat] Connection error:', err.message));

    s.on('new_message', (msg) => {
      setMessages(prev => {
        if (prev.some(m => m.id === msg.id)) return prev;
        return [...prev, msg];
      });
      // Increment unread if chat is closed
      if (msg.senderId !== user?.id) {
        setUnread(prev => prev + 1);
      }
    });

    s.on('user_typing', ({ userName }) => {
      setTyping(userName);
    });
    s.on('user_stop_typing', () => {
      setTyping(null);
    });

    setSocket(s);
    return () => { s.disconnect(); };
  }, [user?.id]);

  /* ── auto-scroll ── */
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, typing]);

  /* ── fetch conversation list ── */
  const fetchConversations = useCallback(async () => {
    try {
      const res = await api.get('/conversations');
      setConvList(res.data);
    } catch (e) { /* silent */ }
  }, []);

  useEffect(() => {
    if (open && !inChat) fetchConversations();
  }, [open, inChat, fetchConversations]);

  /* ── join a conversation ── */
  const joinConversation = async (cid) => {
    if (!cid?.trim() || !socket) return;
    const id = cid.trim();
    setConvId(id);
    setInChat(true);
    setMessages([]);
    setTyping(null);
    setUnread(0);

    // Fetch history
    try {
      const res = await api.get(`/chat/${id}`);
      setMessages(res.data);
    } catch (e) { /* empty chat */ }

    socket.emit('join_conversation', id);
  };

  /* ── leave conversation ── */
  const leaveConversation = () => {
    if (socket && conversationId) {
      socket.emit('leave_conversation', conversationId);
    }
    setInChat(false);
    setConvId('');
    setMessages([]);
    setTyping(null);
  };

  /* ── send message ── */
  const sendMessage = (e) => {
    e.preventDefault();
    if (!input.trim() || !socket || !conversationId) return;

    socket.emit('send_message', {
      conversationId,
      text: input.trim(),
    });

    // Stop typing indicator
    socket.emit('stop_typing', { conversationId });
    setInput('');
  };

  /* ── typing indicator ── */
  const handleInputChange = (e) => {
    setInput(e.target.value);
    if (!socket || !conversationId) return;

    socket.emit('typing', { conversationId });
    clearTimeout(typingTimeout.current);
    typingTimeout.current = setTimeout(() => {
      socket.emit('stop_typing', { conversationId });
    }, 1500);
  };

  /* ── toggle ── */
  const toggleChat = () => {
    setOpen(prev => !prev);
    if (!open) setUnread(0);
  };

  /* ── group messages by date ── */
  const groupedMessages = messages.reduce((acc, msg) => {
    const dateKey = fmtDate(msg.timestamp);
    if (!acc.length || acc[acc.length - 1].date !== dateKey) {
      acc.push({ date: dateKey, msgs: [msg] });
    } else {
      acc[acc.length - 1].msgs.push(msg);
    }
    return acc;
  }, []);

  const isMine = (msg) => msg.senderId === user?.id;

  return (
    <>
      {/* ── Floating toggle button ── */}
      <button className="chat-fab" onClick={toggleChat} title={open ? 'Close chat' : 'Open chat'}>
        {open ? <CloseIcon/> : <ChatIcon/>}
        {!open && unread > 0 && <span className="chat-fab-badge">{unread > 9 ? '9+' : unread}</span>}
      </button>

      {/* ── Chat panel ── */}
      {open && (
        <div className={`chat-panel ${inChat ? 'chat-panel-active' : ''}`}>

          {/* HEADER */}
          <div className="chat-panel-header">
            {inChat && (
              <button className="chat-back-btn" onClick={leaveConversation}><BackIcon/></button>
            )}
            <div style={{flex:1,minWidth:0}}>
              <div className="chat-panel-title">
                {inChat ? `# ${conversationId}` : 'Messages'}
              </div>
              {inChat && typing && (
                <div className="chat-typing">{typing} is typing…</div>
              )}
              {!inChat && <div className="chat-panel-sub">Doctor ↔ Patient chat</div>}
            </div>
            <button className="chat-close-btn" onClick={toggleChat}><CloseIcon/></button>
          </div>

          {/* BODY */}
          {!inChat ? (
            /* ── Conversation list / join ── */
            <div className="chat-conv-list">
              {/* Join form */}
              <form className="chat-join-form" onSubmit={(e) => { e.preventDefault(); joinConversation(convInput); setConvInput(''); }}>
                <input
                  className="chat-join-input"
                  placeholder="Enter conversation ID…"
                  value={convInput}
                  onChange={e => setConvInput(e.target.value)}
                />
                <button type="submit" className="chat-join-btn" disabled={!convInput.trim()}>Join</button>
              </form>

              <div className="chat-conv-divider">
                <span>Recent conversations</span>
              </div>

              {convList.length > 0 ? (
                convList.map(c => (
                  <button key={c.conversationId} className="chat-conv-item" onClick={() => joinConversation(c.conversationId)}>
                    <div className="chat-conv-icon">#</div>
                    <div style={{flex:1,minWidth:0}}>
                      <div className="chat-conv-name">{c.conversationId}</div>
                      <div className="chat-conv-last">{c.lastMessage?.text?.slice(0,40) || '…'}</div>
                    </div>
                    <div className="chat-conv-count">{c.messageCount}</div>
                  </button>
                ))
              ) : (
                <div className="chat-empty">
                  <div style={{fontSize:28,marginBottom:8,opacity:0.4}}>💬</div>
                  <div>No conversations yet.</div>
                  <div style={{fontSize:11,marginTop:4,color:'var(--text-subtle)'}}>
                    Enter a conversation ID above to start chatting.
                  </div>
                </div>
              )}
            </div>
          ) : (
            /* ── Message area ── */
            <>
              <div className="chat-messages">
                {messages.length === 0 && (
                  <div className="chat-empty">
                    <div style={{fontSize:28,marginBottom:8,opacity:0.4}}>👋</div>
                    <div>Start the conversation!</div>
                    <div style={{fontSize:11,marginTop:4,color:'var(--text-subtle)'}}>
                      Messages are saved to the database and will persist across sessions.
                    </div>
                  </div>
                )}

                {groupedMessages.map((group, gi) => (
                  <div key={gi}>
                    <div className="chat-date-divider"><span>{group.date}</span></div>
                    {group.msgs.map(msg => (
                      <div key={msg.id} className={`chat-msg ${isMine(msg) ? 'chat-msg-mine' : 'chat-msg-other'}`}>
                        {!isMine(msg) && (
                          <div className="chat-msg-avatar">
                            {(msg.senderName || '?')[0].toUpperCase()}
                          </div>
                        )}
                        <div className="chat-msg-body">
                          {!isMine(msg) && (
                            <div className="chat-msg-sender">
                              {msg.senderName}
                              <span className={`chat-msg-role chat-msg-role-${msg.senderRole}`}>{msg.senderRole}</span>
                            </div>
                          )}
                          <div className={`chat-msg-bubble ${isMine(msg) ? 'chat-bubble-mine' : 'chat-bubble-other'}`}>
                            {msg.text}
                          </div>
                          <div className="chat-msg-time">{fmtTime(msg.timestamp)}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                ))}

                {typing && (
                  <div className="chat-msg chat-msg-other">
                    <div className="chat-msg-avatar">·</div>
                    <div className="chat-msg-body">
                      <div className="chat-bubble-other chat-msg-bubble chat-typing-bubble">
                        <span className="chat-typing-dots"><span/><span/><span/></span>
                      </div>
                    </div>
                  </div>
                )}

                <div ref={messagesEndRef}/>
              </div>

              {/* ── Input ── */}
              <form className="chat-input-bar" onSubmit={sendMessage}>
                <input
                  className="chat-input"
                  placeholder="Type a message…"
                  value={input}
                  onChange={handleInputChange}
                  autoFocus
                />
                <button type="submit" className="chat-send-btn" disabled={!input.trim()}>
                  <SendIcon/>
                </button>
              </form>
            </>
          )}
        </div>
      )}
    </>
  );
}
