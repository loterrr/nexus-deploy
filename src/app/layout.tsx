import type { Metadata } from 'next';
import { Newsreader, Plus_Jakarta_Sans, JetBrains_Mono } from 'next/font/google';
import './global.css';
import { ToastProvider } from '@/components/ui/Toast';

const newsreader = Newsreader({
  subsets: ['latin'],
  variable: '--font-serif',
  display: 'swap',
  style: ['normal', 'italic'],
  adjustFontFallback: false,
});

const plusJakartaSans = Plus_Jakarta_Sans({
  subsets: ['latin'],
  variable: '--font-sans',
  display: 'swap',
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--font-mono',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'Nexus: The Archive — Local RAG Research Assistant',
  description: '100% Local, Privacy-First Multi-Stage RAG Research Engine running on consumer edge devices.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`${newsreader.variable} ${plusJakartaSans.variable} ${jetbrainsMono.variable}`}>
      <body className="font-sans antialiased bg-white text-slate-900 selection:bg-blue-100 selection:text-blue-900">
        <ToastProvider>
          {children}
        </ToastProvider>
      </body>
    </html>
  );
}
