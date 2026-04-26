package com.localnow.request.repository;

import java.time.LocalDateTime;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.jdbc.AutoConfigureTestDatabase;
import org.springframework.boot.test.autoconfigure.orm.jpa.DataJpaTest;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.testcontainers.containers.MySQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;

import com.localnow.request.domain.HelpRequest;
import com.localnow.request.domain.HelpRequestStatus;
import com.localnow.request.domain.RequestType;

@DataJpaTest(properties = {
        "spring.jpa.hibernate.ddl-auto=create-drop",
        "spring.flyway.enabled=false"
})
@AutoConfigureTestDatabase(replace = AutoConfigureTestDatabase.Replace.NONE)
@Testcontainers(disabledWithoutDocker = true)
class HelpRequestRepositoryIT {

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
    private HelpRequestRepository repository;

    @Test
    void save_and_findByTravelerId_returns_saved_request() {
        HelpRequest request = buildRequest(100L, RequestType.GUIDE, 5000L);
        repository.save(request);

        List<HelpRequest> results = repository.findByTravelerIdOrderByCreatedAtDesc(100L);

        assertThat(results).hasSize(1);
        assertThat(results.get(0).getTravelerId()).isEqualTo(100L);
        assertThat(results.get(0).getStatus()).isEqualTo(HelpRequestStatus.OPEN);
        assertThat(results.get(0).getBudgetKrw()).isEqualTo(5000L);
    }

    @Test
    void findByTravelerId_returns_multiple_ordered_by_createdAt_desc() {
        repository.save(buildRequest(200L, RequestType.GUIDE, 3000L));
        repository.save(buildRequest(200L, RequestType.TRANSLATION, 7000L));
        repository.save(buildRequest(999L, RequestType.FOOD, 1000L));

        List<HelpRequest> results = repository.findByTravelerIdOrderByCreatedAtDesc(200L);

        assertThat(results).hasSize(2);
        assertThat(results).allMatch(r -> r.getTravelerId().equals(200L));
    }

    @Test
    void countGroupByStatus_returns_correct_counts_per_status() {
        HelpRequest open1 = buildRequest(300L, RequestType.GUIDE, 5000L);
        HelpRequest open2 = buildRequest(300L, RequestType.FOOD, 3000L);
        HelpRequest completed = buildRequest(300L, RequestType.TRANSLATION, 4000L);
        completed.toMatched();
        completed.toCompleted();

        repository.save(open1);
        repository.save(open2);
        repository.save(completed);

        List<Object[]> rows = repository.countGroupByStatus();

        assertThat(rows).isNotEmpty();

        long openCount = rows.stream()
                .filter(r -> r[0] == HelpRequestStatus.OPEN)
                .mapToLong(r -> (Long) r[1])
                .sum();
        long completedCount = rows.stream()
                .filter(r -> r[0] == HelpRequestStatus.COMPLETED)
                .mapToLong(r -> (Long) r[1])
                .sum();

        assertThat(openCount).isEqualTo(2L);
        assertThat(completedCount).isEqualTo(1L);
    }

    private HelpRequest buildRequest(Long travelerId, RequestType type, long budgetKrw) {
        HelpRequest r = new HelpRequest();
        r.setTravelerId(travelerId);
        r.setRequestType(type);
        r.setLat(37.5665);
        r.setLng(126.9780);
        r.setStartAt(LocalDateTime.now().plusHours(1));
        r.setDurationMin(60);
        r.setBudgetKrw(budgetKrw);
        r.setStatus(HelpRequestStatus.OPEN);
        return r;
    }
}
