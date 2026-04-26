/**
 * 스프링 부트 구성을 역할별 하위 패키지로 둔다.
 * <ul>
 *   <li>{@code security} — Spring Security, JWT, OAuth2</li>
 *   <li>{@code websocket} — STOMP / 웹소켓</li>
 *   <li>{@code redis} — Redis 클라이언트 템플릿</li>
 *   <li>{@code rabbit} — RabbitMQ (교환/큐/바인딩)</li>
 * </ul>
 */
package com.localnow.config;
