import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'PROGRESO+',
  description: 'Tu espacio para organizar lo importante.'
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="es"><body>{children}</body></html>;
}

