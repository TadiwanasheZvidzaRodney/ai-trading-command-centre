import type { Metadata, Viewport } from 'next';
import { AppShell } from '@/components/AppShell';
import { PwaRegister } from '@/components/PwaRegister';
import './globals.css';
import './mobile-enhancements.css';

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
  width: 'device-width',
  initialScale: 1,
  minimumScale: 1,
  maximumScale: 5,
  userScalable: true,
  viewportFit: 'cover',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body suppressHydrationWarning>
        <PwaRegister />
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
