import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      // Google 계정 프로필 이미지 (Supabase Auth의 user_metadata.avatar_url)
      { protocol: 'https', hostname: 'lh3.googleusercontent.com' },
    ],
  },
  // 기존 기능(Google OAuth 리다이렉트, Pretendard CDN, Supabase, Mixpanel, Vercel
  // Analytics)에 영향이 없는 헤더만 추가한다. CSP는 외부 origin이 많아(OAuth,
  // CDN 폰트, Supabase, Mixpanel, Vercel Analytics) 잘못 설정하면 서비스가 깨질
  // 위험이 커서 여기서는 추가하지 않는다(보안 검토 보고서의 권장안 참고).
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
        ],
      },
    ];
  },
};

export default nextConfig;
