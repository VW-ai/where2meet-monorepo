import type { Metadata } from 'next';
import './globals.css';
import { SessionProvider } from '@/components/auth/session-provider';

export const metadata: Metadata = {
  title: 'Where2Meet - Find the Perfect Meeting Spot',
  description: 'Find the perfect meeting spot for everyone with Where2Meet',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>
        <SessionProvider>{children}</SessionProvider>
      </body>
    </html>
  );
}
