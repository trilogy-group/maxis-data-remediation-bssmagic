'use client';

import type { ReactNode } from 'react';
import { useEffect, useState } from 'react';
import { startMsw } from './browser';

type Props = { children?: ReactNode };

export function MswInit({ children }: Props) {
  const [started, setStarted] = useState(false);

  useEffect(() => {
    startMsw().then(() => setStarted(true));
  }, []);

  if (!started) return null;
  return children;
}
