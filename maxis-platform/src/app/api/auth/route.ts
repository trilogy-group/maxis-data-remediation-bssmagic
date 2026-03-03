import { NextRequest, NextResponse } from 'next/server';
import { getSession, validateCredentials } from '@/lib/server/auth';

export async function POST(request: NextRequest) {
  const body = await request.json();

  if (body.action === 'login') {
    const { email, password } = body;
    const result = validateCredentials(email, password);

    if (!result.valid) {
      return NextResponse.json({ error: 'Invalid email or password' }, { status: 401 });
    }

    const session = await getSession();
    session.email = email;
    session.name = result.name;
    session.isLoggedIn = true;
    await session.save();

    return NextResponse.json({ success: true, name: result.name, email });
  }

  if (body.action === 'logout') {
    const session = await getSession();
    session.destroy();
    return NextResponse.json({ success: true });
  }

  if (body.action === 'check') {
    const session = await getSession();
    if (session.isLoggedIn) {
      return NextResponse.json({ isLoggedIn: true, name: session.name, email: session.email });
    }
    return NextResponse.json({ isLoggedIn: false });
  }

  return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
}
