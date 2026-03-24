import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Belka (Max edition)',
  description: 'Играйте в Belka (Max edition) онлайн с друзьями.',
  icons: { icon: '/favicon.ico' },
  manifest: '/manifest.json',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ru">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <meta name="theme-color" content="#1a1b1f" />
      </head>
      <body>{children}</body>
    </html>
  );
}
