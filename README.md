# OHAYO! 🌸

일본식 별자리 운세를 읽으면서 일본어 단어를 자연스럽게 학습하고 저장할 수 있는 모바일 웹 서비스입니다.

## 현재 상태

**M1 완료** — 더미 데이터 기반 프론트엔드 MVP

## 실행 방법

### 1. 의존성 설치

```bash
npm install
```

### 2. 환경 변수 설정

```bash
cp .env.example .env.local
# .env.local에 값을 채워주세요 (M1은 환경 변수 없어도 실행 가능)
```

### 3. 개발 서버 실행

```bash
npm run dev
```

브라우저에서 [http://localhost:3000](http://localhost:3000) 접속

### 4. 빌드 확인

```bash
npm run build
npm run start
```

### 5. 린트 확인

```bash
npm run lint
```

## 폴더 구조

```
src/
├── app/                    # Next.js App Router 페이지
│   ├── page.tsx            # 홈 (/)
│   ├── fortune/[zodiacId]/ # 별자리 상세 (/fortune/[zodiacId])
│   └── saved/             # 저장 단어 (/saved)
├── components/
│   ├── ui/                # Button, BottomNavigation, BottomSheet, Toast
│   ├── fortune/           # 운세 관련 컴포넌트
│   ├── vocabulary/        # 단어·플래시카드 컴포넌트
│   ├── auth/              # 로그인 안내 컴포넌트
│   └── common/            # EmptyState, LoadingState, ErrorState
├── hooks/                 # useSavedVocabulary 등 커스텀 훅
├── lib/
│   ├── zodiac.ts          # 12개 별자리 상수
│   └── fortune/mock.ts    # M1용 더미 데이터
└── types/                 # TypeScript 타입 정의
```

## 개발 단계

| 단계 | 내용 | 상태 |
|---|---|---|
| M1 | 더미 데이터 기반 프론트엔드 MVP | ✅ 완료 |
| M2 | Google 로그인 + Supabase 단어 저장 | 🔲 예정 |
| M3 | 플래시카드 복습 화면 | 🔲 예정 |
| M4 | 오하아사 크롤링 | 🔲 예정 |
| M5 | Gemini AI + Vercel Cron 자동화 | 🔲 예정 |

## 기술 스택

- **프레임워크**: Next.js 15 (App Router)
- **언어**: TypeScript
- **스타일링**: Tailwind CSS + CSS 변수 기반 디자인 토큰
- **폰트**: Pretendard JP (한국어·일본어·영어 통합)
- **배포 예정**: Vercel

## 디자인 시스템

- 라이트 테마 기반
- 브랜드 컬러: `#5960ec`
- 폰트: `"Pretendard JP", Pretendard, sans-serif`
- 디자인 토큰: `src/app/globals.css`의 CSS 변수로 관리
