# UI 디자인 가이드

웹(`web/`)의 유일한 디자인 기준 문서. 여기서 벗어나려면 ADR 이 필요하다.

## 디자인 원칙
1. **도구처럼 보여야 한다.** 마케팅 랜딩이 아니라 매일 쓰는 관제 콘솔. 여백·좌측 정렬·단순 격자 기본.
2. **정보 밀도 우선.** 크게 띄우는 히어로 텍스트, 장식용 일러스트, 3D 아이콘을 넣지 않는다.
3. **상태가 눈에 들어와야 한다.** 요청 / 매칭 / 결제 / 연결 상태는 색이 아니라 **라벨 + 아이콘 + 위치**로 먼저 전달한다. 색은 보조.

## AI 슬롭 안티패턴 — 하지 마라
| 금지 사항 | 이유 |
|-----------|------|
| `backdrop-filter: blur()` / glass morphism | AI 템플릿의 가장 흔한 징후 |
| gradient-text (배경 그라데이션 텍스트) | AI 가 만든 SaaS 랜딩의 1번 특징 |
| "Powered by AI" 배지, "Next-gen ..." 문구 | 기능이 아니라 장식 |
| `box-shadow` 로 네온 글로우 | AI 슬롭의 대표 징후 |
| 보라/인디고 브랜드 색상 | "AI = 보라색" 클리셰 |
| 모든 카드에 동일한 `rounded-2xl` | 균일한 둥근 모서리 = 템플릿 느낌 |
| 배경 gradient orb (`blur-3xl` 원형) | 모든 AI 랜딩 페이지에 있는 장식 |
| 이모지 아이콘 (🚀 ✨ 🎉 등) 본문 사용 | 부자연스러움, 톤 깨짐 |
| 아이콘을 둥근 배경 박스로 감싸기 | "앱 스토어 아이콘" 느낌 |

## 색상

### 배경
| 용도 | 값 |
|------|------|
| 페이지 | `#0a0a0a` (`bg-neutral-950`) |
| 카드 / 패널 | `#141414` |
| 호버 | `#1c1c1c` |
| 경계선 | `#262626` (`border-neutral-800`) |

### 텍스트
| 용도 | 값 |
|------|------|
| 주 텍스트 | `text-white` |
| 본문 | `text-neutral-300` |
| 보조 | `text-neutral-400` |
| 비활성 / 메타 | `text-neutral-500` |

### 포인트 (단 하나만 사용)
| 용도 | 값 |
|------|------|
| 기본 포인트 | `#f59e0b` (amber-500). CTA, 활성 상태, 매칭 성공 하이라이트 |
| 포인트 hover | `#fbbf24` (amber-400) |

### 데이터 / 시맨틱
| 용도 | 값 |
|------|------|
| 성공 / OK | `#22c55e` (green-500) |
| 경고 / 대기 | `#eab308` (yellow-500) |
| 오류 / 취소 | `#ef4444` (red-500) |
| 중립 | `#525252` (neutral-600) |

요청 상태 색 매핑은 **이 한 세트로 통일한다**:
- `OPEN` → 경고(대기)
- `MATCHED` → 포인트(amber)
- `IN_PROGRESS` → 성공(green)
- `COMPLETED` → 중립(neutral-600)
- `CANCELLED` → 오류(red)

## 컴포넌트

### 카드
```
rounded-lg bg-[#141414] border border-neutral-800 p-6
```
hover 가 의미 있는 카드만:
```
hover:bg-[#1c1c1c] hover:border-neutral-700 transition-colors
```

### 버튼
```
Primary   (강조):   rounded-md bg-amber-500 text-black font-medium px-4 py-2 hover:bg-amber-400 disabled:bg-neutral-700 disabled:text-neutral-500
Secondary (기본):   rounded-md bg-neutral-800 text-white px-4 py-2 hover:bg-neutral-700
Text     (약한):   text-neutral-400 hover:text-white
Danger   (취소):   rounded-md bg-red-500/10 text-red-400 border border-red-500/40 px-4 py-2 hover:bg-red-500/20
```

### 입력 필드
```
rounded-md bg-neutral-900 border border-neutral-800 px-3 py-2 text-white
placeholder:text-neutral-500
focus:outline-none focus:border-amber-500
```

### 상태 뱃지 (Status Pill)
```
inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium
```
색은 위 "요청 상태 색 매핑" 을 따른다. 배지 안에는 작은 점(`h-1.5 w-1.5 rounded-full`) + 라벨 텍스트.

### 실시간 연결 인디케이터
- 연결됨: 점 `bg-green-500` + "connected" (small, neutral-400).
- 재연결 중: 점 `bg-yellow-500 animate-pulse` + "reconnecting...".
- 끊김: 점 `bg-red-500` + "disconnected".

### 지도 (Leaflet)
- 컨테이너: `rounded-lg overflow-hidden border border-neutral-800`.
- 타일: OpenStreetMap 기본 + dark matter 스타일(`https://basemaps.cartocdn.com/dark_all/`).
- 내 위치 마커: 작은 amber 점. 가이드 마커: 흰색 원 + 테두리.

## 레이아웃
- 전체 너비: `max-w-6xl mx-auto`.
- 정렬: 좌측 정렬 기본. 중앙 정렬은 로그인/회원가입 같은 단일 폼에서만.
- 간격: 카드 내부 `p-6`, 섹션 간 `space-y-6`, 카드 간 `gap-4`.
- 페이지 구성: 좌측 sidebar 금지 (MVP). 상단 얇은 헤더(로고 + 사용자 + 로그아웃) + 메인 콘텐츠 2열 그리드(`grid-cols-12`).

## 타이포그래피
| 용도 | 스타일 |
|------|--------|
| 페이지 제목 | `text-2xl font-semibold text-white` |
| 섹션 제목 | `text-sm font-medium uppercase tracking-wide text-neutral-500` |
| 카드 제목 | `text-base font-medium text-white` |
| 본문 | `text-sm text-neutral-300 leading-relaxed` |
| 메타(시간/거리) | `text-xs text-neutral-500 tabular-nums` |
| 금액 | `text-base font-semibold text-white tabular-nums` |

폰트는 시스템 기본(sans-serif). 커스텀 웹폰트 금지.

## 애니메이션 (허용 목록)
- `fade-in` 0.2s — 신규 카드 등장.
- `slide-up` 0.2s — 모달/드로어.
- `animate-pulse` — 로딩/연결 재시도 인디케이터.
- 그 외 모든 애니메이션 금지. 특히 hover 시 카드 확대(`scale`), 회전, bounce 금지.

## 아이콘
- `lucide-react` 만 사용. `strokeWidth={1.5}`, 크기 `h-4 w-4` 또는 `h-5 w-5`.
- 아이콘을 둥근 배경 박스로 감싸지 않는다. 텍스트 옆에 `gap-2` 로 인라인 배치.

## 반응형
- MVP 는 **데스크톱 1280px 기준** 으로만 맞춘다. 모바일 반응형은 하지 않는다(README 에 명시).
- 최소 지원: `min-w-[1024px]`. 그 이하에서는 "시연은 데스크톱에서" 안내 배너 한 줄로 대체.
