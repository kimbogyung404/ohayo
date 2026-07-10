import type { Metadata, Viewport } from 'next';
import './globals.css';
import BottomNavigation from '@/components/ui/BottomNavigation';
import { ToastProvider } from '@/components/ui/Toast';

export const metadata: Metadata = {
  title: 'OHAYO! | 오늘의 별자리 운세로 일본어 학습',
  description:
    '일본식 별자리 운세를 읽으면서 일본어 단어를 자연스럽게 학습하고 저장할 수 있는 모바일 웹 서비스입니다.',
  keywords: ['일본어 학습', '별자리 운세', '일본어 단어', '오하아사', 'おはよう朝日です'],
  openGraph: {
    title: 'OHAYO! | 오늘의 별자리 운세로 일본어 학습',
    description: '운세를 읽으며 자연스럽게 일본어를 배워요.',
    type: 'website',
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko" className="h-full">
      <head>
        {/* Pretendard JP — CDN (M1 임시. 프로덕션에서는 next/font/local로 교체 권장) */}
        <link
          rel="stylesheet"
          href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/static/pretendard-jp-dynamic-subset.min.css"
          crossOrigin="anonymous"
        />
      </head>
      <body className="h-full">
        <ToastProvider>
          <div id="app-container">
            <main className="page-content">{children}</main>
            <BottomNavigation />
          </div>
        </ToastProvider>
      </body>
    </html>
  );
}
