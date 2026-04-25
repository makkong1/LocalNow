package com.localnow.common.monitoring;

/**
 * SLF4J MDC 키. 로그 패턴({@code %X{...}}) 및 필터/Aspect 에서 공통으로 사용한다.
 */
public final class MdcKeys {

    public static final String REQUEST_ID = "requestId";
    public static final String OPERATION = "operation";

    private MdcKeys() {}
}
