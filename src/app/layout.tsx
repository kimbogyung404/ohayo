import type { Metadata, Viewport } from 'next';
import { Analytics } from '@vercel/analytics/next';
import './globals.css';
import { ToastProvider } from '@/components/ui/Toast';
import SplashScreen from '@/components/common/SplashScreen';
import { SPLASH_INIT_SCRIPT } from '@/lib/splash';

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
    <html lang="ko" className="h-full" suppressHydrationWarning>
      <head>
        {/* 스플래시 표시 여부 판단용 블로킹 인라인 스크립트. SplashScreen(React)의
            hydration을 기다리지 않고 첫 페인트 전에 실행되어야 하므로 next/script가
            아닌 순수 <script> 태그를 쓴다(src/lib/splash.ts 참고). */}
        <script dangerouslySetInnerHTML={{ __html: SPLASH_INIT_SCRIPT }} />
        {/* Pretendard JP — CDN (M1 임시. 프로덕션에서는 next/font/local로 교체 권장) */}
        <link
          rel="stylesheet"
          href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/static/pretendard-jp-dynamic-subset.min.css"
          crossOrigin="anonymous"
        />
      </head>
      <body className="h-full">
        <SplashScreen />
        <ToastProvider>
          <div id="app-container">
            <main>{children}</main>
          </div>
        </ToastProvider>
        <Analytics />
      </body>
    </html>
  );
}
