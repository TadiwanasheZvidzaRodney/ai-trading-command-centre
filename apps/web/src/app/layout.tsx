import type { Metadata, Viewport } from 'next';
import { AppShell } from '@/components/AppShell';
import { PwaRegister } from '@/components/PwaRegister';
import './globals.css';

export const metadata: Metadata = {
  title: 'AI Trading Command Centre',
  description:
    'Personal research, analysis, risk and paper-trading workspace for XAU/USD, EUR/USD and GBP/USD.',
  applicationName: 'AI Trading Command Centre',
  icons: {
    icon: '/icon.svg',
    apple: '/icon-192.png',
  },
};

export const viewport: Viewport = {
  themeColor: '#07131a',
  colorScheme: 'dark',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <PwaRegister />
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
