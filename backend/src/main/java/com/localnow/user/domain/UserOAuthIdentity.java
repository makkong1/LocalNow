package com.localnow.user.domain;

import java.time.LocalDateTime;

import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import jakarta.persistence.UniqueConstraint;
import lombok.Data;

/**
 * 외부 IdP(예: Google)의 고정 식별자(sub)와 로컬 {@code users.id}를 연결한다.
 * <p>
 * Lombok {@code @RequiredArgsConstructor}는 {@code final} 필드만 받는 생성자를 만들 뿐이라,
 * 이 엔티티처럼 가변 필드만 있으면 (userId, provider, sub) 생성자가 자동 생성되지 않는다.
 * JPA는 리플렉션으로 엔티티를 로드·프록시하기 위해 <b>무인자 생성자</b>가 필요하므로
 * 무인자 + 연동용 3인자 생성자를 명시한다.
 */
@Entity
@Table(name = "user_oauth_identities", uniqueConstraints = @UniqueConstraint(name = "uq_oauth_provider_sub", columnNames = {
                "provider", "provider_user_id" }))
@Data
public class UserOAuthIdentity {

        @Id
        @GeneratedValue(strategy = GenerationType.IDENTITY)
        private Long id;

        @Column(name = "user_id", nullable = false)
        private Long userId;

        @Enumerated(EnumType.STRING)
        @Column(nullable = false, length = 32)
        private OAuth2ProviderType provider;

        @Column(name = "provider_user_id", nullable = false, length = 255)
        private String providerUserId;

        @CreationTimestamp
        @Column(name = "created_at", nullable = false, updatable = false)
        private LocalDateTime createdAt;

        @UpdateTimestamp
        @Column(name = "updated_at", nullable = false)
        private LocalDateTime updatedAt;

        /** Hibernate/JPA 필수: 엔티티 인스턴스화·지연 로딩 시 사용 */
        public UserOAuthIdentity() {
        }

        /** 서비스 계층에서 신규 행 저장 시 (id·타임스탬프는 DB/리스너가 채움) */
        public UserOAuthIdentity(Long userId, OAuth2ProviderType provider, String providerUserId) {
                this.userId = userId;
                this.provider = provider;
                this.providerUserId = providerUserId;
        }

}
