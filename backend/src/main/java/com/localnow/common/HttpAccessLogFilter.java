package com.localnow.common;

import java.io.IOException;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.Ordered;
import org.springframework.lang.NonNull;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;

/**
 * 요청당 한 줄(메서드, URI, 응답 코드, ms). {@code app.http-access-log=false} 로 끄기
 */
@Component
public class HttpAccessLogFilter extends OncePerRequestFilter implements Ordered {

    private static final Logger log = LoggerFactory.getLogger("com.localnow.http");

    @Value("${app.http-access-log:true}")
    private boolean accessLog;

    @Override
    public int getOrder() {
        return Ordered.HIGHEST_PRECEDENCE + 1;
    }

    @Override
    protected void doFilterInternal(
            @NonNull HttpServletRequest request,
            @NonNull HttpServletResponse response,
            @NonNull FilterChain filterChain) throws ServletException, IOException {
        if (!accessLog) {
            filterChain.doFilter(request, response);
            return;
        }
        long t0 = System.nanoTime();
        String method = request.getMethod();
        String path = request.getRequestURI();
        if (path == null) {
            path = "";
        }
        if (request.getQueryString() != null) {
            path = path + "?" + request.getQueryString();
        }
        try {
            filterChain.doFilter(request, response);
        } finally {
            long ms = (System.nanoTime() - t0) / 1_000_000L;
            log.info("reason=HTTP_ACCESS ko=HTTP 접근 로그 method={} path={} status={} durationMs={}",
                    method, path, response.getStatus(), ms);
        }
    }
}
