import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { User } from '../models/User';

const router = Router();
const JWT_SECRET = process.env.JWT_SECRET || 'clinical-handoff-super-secret';

// POST /api/v1/auth/login
router.post('/login', async (req: Request, res: Response) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password are required' });
  }

  const user = User.findUserByUsername(username);
  if (!user) {
    return res.status(401).json({ error: 'Login Failed: Invalid username or password' });
  }

  const validPassword = await bcrypt.compare(password, user.password);
  if (!validPassword) {
    return res.status(401).json({ error: 'Login Failed: Invalid username or password' });
  }

  const token = jwt.sign(
    { 
      sub: user.id, 
      id: user.id, 
      username: user.username,
      role: user.role || 'clinician'
    },
    JWT_SECRET,
    { expiresIn: '12h' }
  );

  res.json({ token, user: { id: user.id, username: user.username, role: user.role || 'clinician' } });
});

export default router;
