import { useEffect, useRef, useCallback } from 'react';
import { io } from 'socket.io-client';

const API_URL = import.meta.env.VITE_API_URL || 'https://majorproject-3q5w.onrender.com';

/**
 * useAppointmentSocket — shared hook for real-time appointment sync.
 *
 * Connects once per component mount, auto-joins the user's personal room,
 * and fires callbacks when appointments are created or updated by anyone
 * (doctor, patient, or admin).
 *
 * @param {Object}   user                 — { id, name, role }
 * @param {Function} onAppointmentCreated — called with the new enriched appointment
 * @param {Function} onAppointmentUpdated — called with the updated enriched appointment
 * @returns {{ socketRef }}
 */
export default function useAppointmentSocket(user, onAppointmentCreated, onAppointmentUpdated) {
  const socketRef = useRef(null);

  // Stable callback refs to avoid re-subscribing on every render
  const onCreatedRef = useRef(onAppointmentCreated);
  const onUpdatedRef = useRef(onAppointmentUpdated);
  useEffect(() => { onCreatedRef.current = onAppointmentCreated; }, [onAppointmentCreated]);
  useEffect(() => { onUpdatedRef.current = onAppointmentUpdated; }, [onAppointmentUpdated]);

  useEffect(() => {
    const token = localStorage.getItem('hms_token');
    if (!token || !user?.id) return;

    // Reuse existing ChatWidget socket? No — they have different lifecycles.
    // Each component creates its own connection; Socket.IO multiplexes under the hood.
    const socket = io(API_URL, {
      auth: { token },
      transports: ['websocket', 'polling'],
    });

    socket.on('connect', () => {
      console.log(`[ApptSocket] Connected — user room: user_${user.id}`);
    });

    socket.on('connect_error', (err) => {
      console.warn('[ApptSocket] Connection error:', err.message);
    });

    // Listen for real-time appointment events
    socket.on('appointmentCreated', (appt) => {
      console.log('[ApptSocket] appointmentCreated', appt.id);
      onCreatedRef.current?.(appt);
    });

    socket.on('appointmentUpdated', (appt) => {
      console.log('[ApptSocket] appointmentUpdated', appt.id, '→', appt.status);
      onUpdatedRef.current?.(appt);
    });

    socketRef.current = socket;

    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
  }, [user?.id]);

  return { socketRef };
}
