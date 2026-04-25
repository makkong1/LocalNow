package com.localnow.common.monitoring;

import org.aspectj.lang.ProceedingJoinPoint;
import org.aspectj.lang.annotation.Around;
import org.aspectj.lang.annotation.Aspect;
import org.aspectj.lang.annotation.Pointcut;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.core.Ordered;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;

/**
 * {@code com.localnow..service} 공개 메서드에 MDC {@code operation}을 설정해
 * (동일 스레드의) JPA/SQL/리포지토리 로그와 용도를 연결하고,
 * 최상위 서비스 호출 단위로 소요 시간·힙 사용 변화(근사치)를 남긴다.
 */
@Aspect
@Component
@Order(Ordered.HIGHEST_PRECEDENCE)
public class ServiceLayerMonitoringAspect {

    private static final Logger log = LoggerFactory.getLogger(ServiceLayerMonitoringAspect.class);

    @Pointcut("execution(public * com.localnow..service..*.*(..))")
    public void serviceLayer() {}

    @Around("serviceLayer()")
    public Object monitor(ProceedingJoinPoint joinPoint) throws Throwable {
        String operation = joinPoint.getSignature().getDeclaringType().getSimpleName()
                + "#"
                + joinPoint.getSignature().getName();
        boolean outer = OperationMdcHolder.enter(operation);
        long startNs = System.nanoTime();
        long usedHeapBefore = usedHeapBytes();
        try {
            return joinPoint.proceed();
        } finally {
            try {
                if (outer) {
                    long durationMs = (System.nanoTime() - startNs) / 1_000_000L;
                    long deltaBytes = usedHeapBytes() - usedHeapBefore;
                    log.info("service.monitor op={} durationMs={} heapDeltaBytes={}", operation, durationMs, deltaBytes);
                }
            } finally {
                OperationMdcHolder.leave();
            }
        }
    }

    private static long usedHeapBytes() {
        Runtime rt = Runtime.getRuntime();
        return rt.totalMemory() - rt.freeMemory();
    }
}
