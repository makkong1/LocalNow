이 프로젝트의 변경 사항을 리뷰하라.

먼저 다음 문서들을 읽어라:
- `/CLAUDE.md`
- `/docs/ARCHITECTURE.md`
- `/docs/ADR.md`
- `/docs/API_CONVENTIONS.md`
- `/docs/UI_GUIDE.md` (웹 변경이 포함된 경우)

그런 다음 변경된 파일들을 확인하고, 아래 체크리스트로 검증하라:

## 체크리스트

1. **아키텍처 준수**: ARCHITECTURE.md 에 정의된 디렉토리 구조와 계층 경계를 따르고 있는가?
   - 백엔드: 컨트롤러 → 서비스 → 리포지토리/인프라
   - 웹: Server Component 기본, Client Component 는 `components/client/` 하위, 브라우저는 `/api/**` Route Handler 만 호출
2. **기술 스택 준수**: ADR 에 정의된 기술 선택을 벗어나지 않았는가? 벗어났다면 새 ADR 이 있는가? (특히 전역 상태 라이브러리 / 유료 지도 API / 실 PG / 번역 API 도입 여부 확인)
3. **API 규약 준수**: 신규/변경된 HTTP·WebSocket 계약이 `docs/API_CONVENTIONS.md` 의 응답 포맷·에러 코드·네이밍을 따르는가? `web/src/types/api.ts` 와 1:1 로 일치하는가?
4. **UI 가이드 준수** (웹 변경 시): `docs/UI_GUIDE.md` 의 색/컴포넌트 토큰을 따르는가? AI 슬롭 안티패턴(보라 그라데이션, backdrop-blur, glow, gradient orb 등)을 사용하지 않았는가?
5. **테스트 존재**: 새로운 기능에 단위/통합 테스트가 작성되어 있는가? 외부 시스템 연동은 Testcontainers / Fake 로, 웹 핵심 플로우는 Playwright 로 검증했는가?
6. **CRITICAL 규칙**: CLAUDE.md 의 CRITICAL 규칙(계층 경계, 트랜잭션/동시성, DTO-엔티티 분리, 시크릿 관리, BFF 경유 원칙, HttpOnly 쿠키)을 위반하지 않았는가?
7. **빌드 가능**: 백엔드는 `./gradlew check`, 웹은 `npm run lint && npm run build` 가 에러 없이 통과하는가?

## 심각도 기준

각 항목은 아래 기준으로 분류한다:

| 심각도 | 정의 | 예시 |
|--------|------|------|
| **Critical** | 데이터 정합성·보안·아키텍처 경계를 깨는 위반. 즉시 수정 필수. | 컨트롤러 → Repository 직접 호출, 시크릿 하드코딩, 브라우저 → 백엔드 직접 호출, 트랜잭션 경계 없는 결제 상태 변경 |
| **Warning** | 코드 품질·규약·테스트 누락. 권장 수정. | API 응답 포맷 미준수, 테스트 없는 신규 서비스 메서드, UI 슬롭 패턴, DTO-엔티티 혼용 |
| **Info** | 가독성·네이밍·문서 동기화 등 사소한 개선. 선택 수정. | 커밋 메시지 컨벤션 미준수, 문서 트리 outdated |

## 출력 형식

| 항목 | 결과 | 심각도 | 비고 |
|------|------|--------|------|
| 아키텍처 준수 | ✅/❌ | Critical/Warning/Info | {상세} |
| 기술 스택 준수 | ✅/❌ | Critical/Warning/Info | {상세} |
| API 규약 준수 | ✅/❌ | Critical/Warning/Info | {상세} |
| UI 가이드 준수 | ✅/❌/N/A | Warning/Info | {상세} |
| 테스트 존재 | ✅/❌ | Warning | {상세} |
| CRITICAL 규칙 | ✅/❌ | Critical | {상세} |
| 빌드 가능 | ✅/❌ | Critical | {상세} |

마지막에 아래 요약을 출력한다:

```
## 리뷰 요약

- Critical: N건  → /fix 또는 /refactor 필수
- Warning:  N건  → 권장 수정
- Info:     N건  → 선택
```

**Critical ≥ 1이면 `/fix` 또는 `/refactor` 없이 `/commit` 진행 금지.**
위반 사항이 있으면 수정 방안을 구체적으로 제시하라.
