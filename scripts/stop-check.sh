#!/usr/bin/env bash
# Claude Code Stop 훅: 턴 종료 시 backend / web 검증을 돌리되,
# 실패해도 턴을 블록하지 않는다 (non-blocking feedback).
#
# 블록하지 않는 이유:
# - harness execute.py 가 이미 AC 검증 + 재시도(3회) + 에러 피드백을 갖고 있다.
# - TDD red phase / 리팩토링 중간 상태에서 턴이 막히면 세션이 꼬인다.
# - 따라서 이 훅은 "마지막에 한 번 돌려보고 경고만 찍는" 용도.
#
# harness 브랜치(feat-*)에서는 execute.py 와 충돌하지 않도록 아예 스킵한다.

set +e

branch="$(git rev-parse --abbrev-ref HEAD 2>/dev/null || echo '')"
case "$branch" in
  feat-*)
    echo "(skip) harness 브랜치($branch) — execute.py 가 AC 검증을 담당"
    exit 0
    ;;
esac

fail=0

if [ -x ./backend/gradlew ]; then
  echo "--- backend compileJava ---"
  # check(=테스트 포함)는 Testcontainers 때문에 분 단위로 걸린다.
  # Stop 훅에서는 컴파일만 확인하고, 테스트는 /test 스킬 또는 gradlew check 로 따로 돌린다.
  if ! (cd backend && ./gradlew --quiet compileJava compileTestJava 2>&1); then
    echo "⚠ backend 컴파일 실패 — 다음 턴에서 수정 권장"
    fail=1
  fi
else
  echo "(skip) backend/gradlew 미생성"
fi

if [ -f ./web/package.json ]; then
  echo "--- web lint ---"
  # build 는 next build 시간이 길다. lint 만으로 타입·규칙 위반을 빠르게 잡는다.
  # 전체 빌드 검증은 /commit 전 또는 CI 에서 한다.
  if ! (cd web && npm run --silent lint 2>&1); then
    echo "⚠ web lint 실패 — 다음 턴에서 수정 권장"
    fail=1
  fi
else
  echo "(skip) web/package.json 미생성"
fi

if [ "$fail" -eq 1 ]; then
  echo "NOTE: 위 검증은 경고일 뿐, 턴을 블록하지 않는다."
  echo "      의도적인 중간 상태(TDD red, 리팩토링 중간)라면 무시해도 된다."
fi

exit 0
