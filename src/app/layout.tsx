import type { Metadata, Viewport } from 'next';
import localFont from 'next/font/local';
import './globals.css';

const archivo = localFont({
  src: './fonts/Archivo-Variable.woff2',
  variable: '--font-archivo',
  weight: '100 900',
  display: 'swap',
  declarations: [{ prop: 'font-stretch', value: '62% 125%' }],
});

export const metadata: Metadata = {
  title: { default: 'NASCO — Déclarations préalables', template: '%s · NASCO DP' },
  description: 'Constitution des dossiers de déclaration préalable pour le Pavillon N°1 NASCO.',
  robots: { index: false, follow: false },
};

export const viewport: Viewport = { themeColor: '#ebebe0' };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr" className={archivo.variable}>
      <body className="min-h-dvh">{children}</body>
    </html>
  );
}
