# OHAYO! Design System

## 1. 개요 (Overview)

- **프로젝트명**:
- **한 줄 설명**: 별자리 운세 서비스. 일본어 학습도 병행.
- **타겟 사용자**: 20대 초반 사용자
- **핵심 목표**: 빠른 정보 탐색, 게임 같은 귀여운 UI 디자인

---

## 2. 디자인 원칙 (Design Principles)

1. 시각적 위계를 명확히
2. 여백을 적극 활용해 시각적 피로도 최소화
3. 모바일 우선 반응형

---

## 컬러 (Color)

```css
:root {
  /* Base */
  --color-white: #ffffff;
  --color-black: #11121a;

  /* Brand */
  --brand-primary: #5960ec;
  --brand-hover: #4e55d8;
  --brand-pressed: #4148bd;
  --brand-light: #c9ccfa;
  --brand-subtle: #eef0ff;
  --brand-focus: rgba(89, 96, 236, 0.24);

  /* Gray */
  --gray-900: #222431;
  --gray-700: #555968;
  --gray-500: #858a99;
  --gray-300: #b8bcc7;
  --gray-100: #e6e8ee;

  /* Text */
  --text-primary: var(--gray-900);
  --text-secondary: var(--gray-700);
  --text-tertiary: var(--gray-500);
  --text-disabled: var(--gray-300);
  --text-brand: var(--brand-primary);
  --text-inverse: var(--color-white);

  /* Surface */
  --surface-default: var(--color-white);
  --surface-subtle: #f7f8fb;
  --surface-brand: var(--brand-subtle);

  /* Border */
  --border-default: var(--gray-100);
  --border-strong: var(--gray-300);
  --border-brand: var(--brand-primary);

  /* Decorative Gradient */
  --gradient-brand-bottom: linear-gradient(
    180deg,
    #ffffff 0%,
    #f3f1f8 28%,
    #d5cef1 44%,
    #9781e9 61%,
    #5960ec 78%,
    #72c8f7 100%
  );
}
```

---

## 타이포그래피 (Typography)

| 토큰명 | 크기 | 줄간격 | 굵기 옵션 |
|---|---|---|---|
| Display | 32px | 130% | Bold |
| H1 | 24px | 130% | Semibold |
| H2 | 20px | 130% | Semibold |
| B1 | 18px | 130% | Semibold / Medium |
| B2 | 16px | 130% | Medium / Regular |
| Caption | 13px | 130% | Medium |

- 폰트 패밀리: Pretendard (Bold & Semibold & Medium & Regular만 사용)

---

## 간격, 라운딩 (Spacing, Radius)

- Spacing: 4 / 8 / 12 / 16 / 24 / 32 / 48
- Radius: 8 / 12 / 16 / 24 / Full
- Button Height: 48 또는 52
- Input Height: 48 또는 52
- Page Padding: 18
- Card Padding: 16 또는 20

---

## 개발 권장값 (Development Defaults)

> 이 문서에 명시되지 않아 개발 과정에서 일반적인 모바일 웹 기준으로 정한 값입니다.
> `src/app/globals.css`에 CSS 변수로 관리됩니다.

| 항목 | 값 | 비고 |
|---|---|---|
| 앱 최대 너비 | 480px | 데스크톱에서 모바일 화면을 중앙 정렬 |
| 하단 내비게이션 높이 | 64px | + `env(safe-area-inset-bottom)` |
| 기본 트랜지션 | 200ms ease | hover 등 빠른 반응은 150ms |
| 플래시카드 플립 트랜지션 | 500ms ease | 별도 전용 값 |
| 바텀시트 오버레이 | `rgba(17, 18, 26, 0.4)` | 검정 계열 40% |
| Status — Success | `#22C55E` | |
| Status — Error | `#EF4444` | |
| Status — Warning | `#F59E0B` | |
| Status — Information | Brand Primary (`#5960ec`) | |

### 그림자 (Shadow) 원칙
- 그림자는 전체적으로 최소화한다.
- 기본 카드와 일반 버튼에는 그림자를 사용하지 않는다.
- 바텀시트·팝오버·토스트처럼 레이어가 겹치는 요소에만 아래의 약한 그림자를 사용한다.

```css
--shadow-overlay: 0 4px 16px rgba(17, 18, 26, 0.08);
```

과한 블러나 진한 그림자, 글로우 효과는 사용하지 않는다.

### 핵심 일본어 단어 강조 박스
- 배경: `--gradient-brand-bottom` (Blue Gradient)
- 라운딩: `--radius-sm` (8px)
- 내부 여백: 상하 2px, 좌우 6px
- 텍스트 색: `--text-inverse` (흰색)
- `inline-flex` 기반 `<button>`으로 구현, 그림자 없음
