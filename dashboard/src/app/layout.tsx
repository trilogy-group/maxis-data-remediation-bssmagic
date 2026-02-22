import type { Metadata } from 'next';
import { AppHeader } from '@/components/app-header';
import { QueryProvider } from '@/components/query-provider';
import { MswInit } from '@/mocks/msw/MswInit';
import './globals.css';

export const metadata: Metadata = {
  title: 'Totogi BSS Application',
  description:
    'Totogi BSS Magic - AI-powered telecommunications business support system',
  keywords: ['Totogi', 'BSS', 'telecommunications', 'AI', 'business support'],
  authors: [{ name: 'Totogi' }],
  creator: 'Totogi',
  publisher: 'Totogi',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>
        <MswInit>
          <QueryProvider>
            <AppHeader />
            {children}
          </QueryProvider>
        </MswInit>
      </body>
    </html>
  );
}
