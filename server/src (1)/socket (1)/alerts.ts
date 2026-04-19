/* ═══════════════════════════════════════════════════════════════
   Socket.io — Real-time Critical Alert Emission
═══════════════════════════════════════════════════════════════ */
import { Server as HttpServer }   from 'http';
import { Server as SocketServer } from 'socket.io';
import jwt                        from 'jsonwebtoken';

let io: SocketServer;

export function initSocket(httpServer: HttpServer): void {
  io = new SocketServer(httpServer, {
    cors: { origin: process.env.CLIENT_ORIGIN ?? 'http://localhost:5173', credentials: true },
  });

  // Authenticate WebSocket connections
  io.use((socket, next) => {
    const token = socket.handshake.auth?.token;
    if (!token) return next(new Error('No token'));
    try {
      const payload = jwt.verify(token, process.env.JWT_SECRET ?? 'changeme_in_production');
      (socket as any).user = payload;
      next();
    } catch {
      next(new Error('Invalid token'));
    }
  });

  io.on('connection', (socket) => {
    const user = (socket as any).user;
    console.log(`[WS] Connected: ${user?.name ?? 'unknown'} (${socket.id})`);

    // Join ward-specific rooms for targeted alerts
    if (user?.ward) socket.join(`ward:${user.ward}`);
    socket.join('all-clinicians');

    socket.on('acknowledge-alert', async ({ alertId }: { alertId: string }) => {
      // Broadcast acknowledgment to other connected users
      socket.broadcast.emit('alert-acknowledged', { alertId, by: user?.name });
    });

    socket.on('disconnect', () => {
      console.log(`[WS] Disconnected: ${socket.id}`);
    });
  });
}

/* ─── Emit from route handlers ────────────────────────────────── */
export function emitCriticalAlert(patientId: string, payload: object): void {
  if (!io) return;

  io.to('all-clinicians').emit('critical-alert', {
    event:   'CRITICAL_VITALS',
    patientId,
    payload,
    timestamp: new Date().toISOString(),
  });

  console.log(`[WS] 🚨 Critical alert emitted for patient ${patientId}`);
}

export function emitHandoffUpdate(wardId: string, payload: object): void {
  if (!io) return;
  io.to(`ward:${wardId}`).emit('handoff-update', payload);
}
