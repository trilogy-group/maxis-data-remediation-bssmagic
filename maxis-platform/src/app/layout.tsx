import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import Header from '@/components/Header';
import Sidebar from '@/components/Sidebar';
import Providers from '@/components/Providers';
import AuthGuard from '@/components/AuthGuard';
import ThemeProvider from '@/components/ThemeProvider';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'Maxis BSS Magic Platform',
  description: 'Operational intelligence platform for Maxis CloudSense issue resolution',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={`${inter.className}`}>
        <Providers>
          <ThemeProvider>
            <AuthGuard>
              <div className="flex flex-col h-screen">
                <Header />
                <div className="flex flex-1 overflow-hidden">
                  <Sidebar />
                  <main className="flex-1 overflow-y-auto bg-slate-50 text-slate-900">
                    {children}
                  </main>
                </div>
              </div>
            </AuthGuard>
          </ThemeProvider>
        </Providers>
      </body>
    </html>
  );
}
