/* ═══════════════════════════════════════════════════════════════
   JWT Auth Middleware + RBAC
═══════════════════════════════════════════════════════════════ */
import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';



export interface AuthPayload {
  sub: string;     // User ID
  id: string;      // Legacy/Alias for ID
  username: string;
  role: string;
  iat: number;
  exp: number;
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthPayload;
    }
  }
}

const JWT_SECRET = process.env.JWT_SECRET || 'clinical-handoff-super-secret';

/* ─── Authenticate JWT ────────────────────────────────────────── */
export function authenticate(req: Request, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    res.status(401).json({ error: 'No token provided' });
    return;
  }

  const token = authHeader.slice(7);
  try {
    const payload = jwt.verify(token, JWT_SECRET) as AuthPayload;
    req.user = payload;
    next();
  } catch (err) {
    if (err instanceof jwt.TokenExpiredError)
      res.status(401).json({ error: 'Token expired. Please log in again.' });
    else
      res.status(401).json({ error: 'Invalid token' });
  }
}

/* ─── Role-Based Access Control ────────────────────────────────── */
export function requireRole(roles: string[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Access denied: insufficient permissions' });
    }
    next();
  };
}

