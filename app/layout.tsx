import type { Metadata } from 'next';
import { ClerkProvider } from '@clerk/nextjs';
import './globals.css';
import './theme.css';

export const metadata: Metadata = {
  title: 'PROGRESO+',
  description: 'Tu espacio para organizar lo importante.',
  applicationName: 'PROGRESO+',
  manifest: '/manifest.webmanifest',
  icons: { icon: '/icon.svg', apple: '/icon.svg' },
  appleWebApp: { capable: true, title: 'PROGRESO+', statusBarStyle: 'default' }
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <ClerkProvider><html lang="es"><body><ServiceWorker />{children}</body></html></ClerkProvider>;
}

function ServiceWorker() {
  return <script dangerouslySetInnerHTML={{ __html: `if ('serviceWorker' in navigator) window.addEventListener('load', () => navigator.serviceWorker.register('/sw.js'));` }} />;
}

