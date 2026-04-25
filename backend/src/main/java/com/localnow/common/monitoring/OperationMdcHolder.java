package com.localnow.common.monitoring;

import java.util.ArrayDeque;
import java.util.Deque;

import org.slf4j.MDC;

/**
 * 서비스 메서드 중첩 호출 시 MDC {@code operation}을 스택으로 유지해,
 * JPA/SQL 등 동일 스레드 로그가 항상 "현재" 실행 중인 메서드에 대응되도록 한다.
 */
public final class OperationMdcHolder {

    private static final ThreadLocal<Deque<String>> STACK = ThreadLocal.withInitial(ArrayDeque::new);

    private OperationMdcHolder() {
    }

    /**
     * @return true 이면 이번 진입이 최상위(스택 깊이 1) 서비스 호출이다. 모니터링 요약 로그는 이 경우에만 남긴다.
     */
    public static boolean enter(String operation) {
        Deque<String> s = STACK.get();
        s.push(operation);
        MDC.put(MdcKeys.OPERATION, operation);
        return s.size() == 1;
    }

    public static void leave() {
        Deque<String> s = STACK.get();
        if (!s.isEmpty()) {
            s.pop();
        }
        if (s.isEmpty()) {
            MDC.remove(MdcKeys.OPERATION);
        } else {
            MDC.put(MdcKeys.OPERATION, s.peek());
        }
    }
}
