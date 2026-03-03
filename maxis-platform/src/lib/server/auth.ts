import { getIronSession, type SessionOptions } from 'iron-session';
import { cookies } from 'next/headers';

export interface SessionData {
  email?: string;
  name?: string;
  isLoggedIn: boolean;
}

const sessionOptions: SessionOptions = {
  password: process.env.SESSION_SECRET || 'maxis-platform-secret-key-at-least-32-chars-long!!',
  cookieName: 'maxis-platform-session',
  cookieOptions: {
    secure: false,
    httpOnly: true,
    sameSite: 'lax' as const,
    maxAge: 60 * 60 * 24 * 7, // 1 week
  },
};

export async function getSession() {
  const cookieStore = await cookies();
  return getIronSession<SessionData>(cookieStore, sessionOptions);
}

const USERS: Record<string, { password: string; name: string }> = {
  'vlad@totogi.com': { password: 'BSSMagic2026!', name: 'Vlad Sorici' },
  'michael.selig@telcodr.com': { password: 'BSSMagic2026!', name: 'Michael Selig' },
  'admin@bssmagic.io': { password: 'BSSMagic2026!', name: 'Admin' },
};

export function validateCredentials(email: string, password: string): { valid: boolean; name?: string } {
  const user = USERS[email.toLowerCase()];
  if (user && user.password === password) {
    return { valid: true, name: user.name };
  }
  return { valid: false };
}
