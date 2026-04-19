import fs from 'fs';
import path from 'path';
import bcrypt from 'bcryptjs';

const USERS_FILE = path.join(__dirname, '..', '..', 'data', 'users.json');

// Ensure data directory and file exist
const DB_DIR = path.dirname(USERS_FILE);
if (!fs.existsSync(DB_DIR)) {
  fs.mkdirSync(DB_DIR, { recursive: true });
}

const seedUsers = [
  { username: "gayatri", password: "login123" },
  { username: "harshita", password: "login123" },
  { username: "anil", password: "login123" },
  { username: "farooq", password: "login123" }
];

export async function initializeAuth() {
  if (!fs.existsSync(USERS_FILE)) {
    console.log('[AUTH] Seeding user accounts...');
    const hashedUsers = await Promise.all(seedUsers.map(async (u) => ({
      id: Math.random().toString(36).substring(2, 12),
      username: u.username,
      password: await bcrypt.hash(u.password, 10),
      created_at: new Date().toISOString()
    })));
    fs.writeFileSync(USERS_FILE, JSON.stringify(hashedUsers, null, 2));
    console.log('[AUTH] User accounts ready.');
  }
}

export const User = {
  findUserByUsername: (username: string) => {
    try {
      const users = JSON.parse(fs.readFileSync(USERS_FILE, 'utf-8'));
      return users.find((u: any) => u.username === username);
    } catch {
      return null;
    }
  }
};
