package com.localnow.user.repository;

import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.TimeUnit;

import static org.assertj.core.api.Assertions.assertThat;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.jdbc.AutoConfigureTestDatabase;
import org.springframework.boot.test.autoconfigure.orm.jpa.DataJpaTest;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;
import org.testcontainers.containers.MySQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;

import com.localnow.user.domain.User;
import com.localnow.user.domain.UserRole;

@DataJpaTest(properties = {
        "spring.jpa.hibernate.ddl-auto=create-drop",
        "spring.flyway.enabled=false"
})
@AutoConfigureTestDatabase(replace = AutoConfigureTestDatabase.Replace.NONE)
@Testcontainers(disabledWithoutDocker = true)
class UserRepositoryIT {

    @Container
    static MySQLContainer<?> mysql = new MySQLContainer<>("mysql:8")
            .withDatabaseName("localnow")
            .withUsername("test")
            .withPassword("test");

    @DynamicPropertySource
    static void props(DynamicPropertyRegistry registry) {
        registry.add("spring.datasource.url", mysql::getJdbcUrl);
        registry.add("spring.datasource.username", mysql::getUsername);
        registry.add("spring.datasource.password", mysql::getPassword);
    }

    @Autowired
    private UserRepository userRepository;

    @Test
    @DisplayName("동시성: 같은 가이드에 10개 리뷰 동시 평점 업데이트 → rating_count 10, avg 정확")
    @Transactional(propagation = Propagation.NOT_SUPPORTED)
    void incrementRating_동시_10개_정확히_반영() throws Exception {
        User guide = new User();
        guide.setEmail("guide-concurrent@test.local");
        guide.setPassword("secret");
        guide.setName("Concurrent Guide");
        guide.setRole(UserRole.GUIDE);
        guide.setAvgRating(BigDecimal.ZERO);
        guide.setRatingCount(0);
        userRepository.save(guide);
        Long guideId = guide.getId();

        ExecutorService executor = Executors.newFixedThreadPool(10);
        List<Future<Integer>> futures = new ArrayList<>();
        for (int i = 0; i < 10; i++) {
            futures.add(executor.submit(() -> userRepository.incrementRating(guideId, 5)));
        }
        for (Future<Integer> f : futures) {
            assertThat(f.get()).isEqualTo(1);
        }
        executor.shutdown();
        assertThat(executor.awaitTermination(30, TimeUnit.SECONDS)).isTrue();

        User reloaded = userRepository.findById(guideId).orElseThrow();
        assertThat(reloaded.getRatingCount()).isEqualTo(10);
        assertThat(reloaded.getAvgRating()).isEqualByComparingTo(new BigDecimal("5.00"));
    }
}
