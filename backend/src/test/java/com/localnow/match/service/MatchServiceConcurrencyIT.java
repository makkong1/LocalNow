package com.localnow.match.service;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicInteger;

import static org.assertj.core.api.Assertions.assertThat;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.web.server.ResponseStatusException;
import org.testcontainers.containers.GenericContainer;
import org.testcontainers.containers.MySQLContainer;
import org.testcontainers.containers.RabbitMQContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;
import org.testcontainers.utility.DockerImageName;

import com.localnow.match.domain.MatchOffer;
import com.localnow.match.domain.MatchOfferStatus;
import com.localnow.match.dto.AcceptRequest;
import com.localnow.match.dto.ConfirmRequest;
import com.localnow.match.dto.MatchOfferResponse;
import com.localnow.match.repository.MatchOfferRepository;
import com.localnow.request.domain.HelpRequest;
import com.localnow.request.domain.HelpRequestStatus;
import com.localnow.request.domain.RequestType;
import com.localnow.request.repository.HelpRequestRepository;
import com.localnow.user.domain.User;
import com.localnow.user.domain.UserRole;
import com.localnow.user.repository.UserRepository;

@SpringBootTest
@Testcontainers(disabledWithoutDocker = true)
class MatchServiceConcurrencyIT {

    @Container
    static MySQLContainer<?> mysql = new MySQLContainer<>(DockerImageName.parse("mysql:8.0"))
            .withDatabaseName("localnow")
            .withUsername("test")
            .withPassword("test");

    @Container
    static GenericContainer<?> redis = new GenericContainer<>(DockerImageName.parse("redis:7-alpine"))
            .withExposedPorts(6379);

    @Container
    static RabbitMQContainer rabbit = new RabbitMQContainer(
            DockerImageName.parse("rabbitmq:3-management-alpine"));

    @DynamicPropertySource
    static void configureProperties(DynamicPropertyRegistry registry) {
        registry.add("spring.datasource.url", mysql::getJdbcUrl);
        registry.add("spring.datasource.username", mysql::getUsername);
        registry.add("spring.datasource.password", mysql::getPassword);
        registry.add("spring.data.redis.host", redis::getHost);
        registry.add("spring.data.redis.port", () -> redis.getMappedPort(6379));
        registry.add("spring.rabbitmq.host", rabbit::getHost);
        registry.add("spring.rabbitmq.port", () -> rabbit.getMappedPort(5672));
    }

    @Autowired
    MatchService matchService;
    @Autowired
    UserRepository userRepository;
    @Autowired
    HelpRequestRepository helpRequestRepository;
    @Autowired
    MatchOfferRepository matchOfferRepository;

    @AfterEach
    void cleanup() {
        matchOfferRepository.deleteAll();
        helpRequestRepository.deleteAll();
        userRepository.deleteAll();
    }

    @Test
    void 동시_확정_시_한_명만_성공() throws Exception {
        User traveler = createUser("traveler@test.com", "Traveler", UserRole.TRAVELER);
        User guide = createUser("guide@test.com", "Guide", UserRole.GUIDE);
        HelpRequest request = createRequest(traveler.getId());
        createOffer(request.getId(), guide.getId());

        int threadCount = 10;
        AtomicInteger success = new AtomicInteger(0);
        AtomicInteger conflict = new AtomicInteger(0);
        CountDownLatch ready = new CountDownLatch(threadCount);
        CountDownLatch start = new CountDownLatch(1);
        CountDownLatch done = new CountDownLatch(threadCount);
        ExecutorService executor = Executors.newFixedThreadPool(threadCount);

        for (int i = 0; i < threadCount; i++) {
            executor.submit(() -> {
                ready.countDown();
                try {
                    start.await();
                    matchService.confirm(request.getId(), traveler.getId(),
                            new ConfirmRequest(guide.getId()));
                    success.incrementAndGet();
                } catch (ResponseStatusException e) {
                    if (e.getStatusCode().value() == 409) {
                        conflict.incrementAndGet();
                    }
                } catch (Exception ignored) {
                } finally {
                    done.countDown();
                }
            });
        }

        ready.await();
        start.countDown();
        boolean finished = done.await(30, TimeUnit.SECONDS);
        executor.shutdown();

        assertThat(finished).isTrue();
        assertThat(success.get()).isEqualTo(1);
        assertThat(conflict.get()).isEqualTo(9);
    }

    @Test
    @org.junit.jupiter.api.DisplayName("동시성: 같은 (requestId, guideId) 동시 수락 10개 → 모두 성공 응답, DB에 offer 1건")
    void 동시_수락_같은_가이드_멱등() throws InterruptedException {
        User traveler = createUser("traveler2@test.com", "Traveler2", UserRole.TRAVELER);
        User guide = createUser("guide2@test.com", "Guide2", UserRole.GUIDE);
        HelpRequest request = createRequest(traveler.getId());

        int threadCount = 10;
        List<MatchOfferResponse> responses = Collections.synchronizedList(new ArrayList<>());
        AtomicInteger errorCount = new AtomicInteger(0);
        CountDownLatch ready = new CountDownLatch(threadCount);
        CountDownLatch start = new CountDownLatch(1);
        CountDownLatch done = new CountDownLatch(threadCount);
        ExecutorService executor = Executors.newFixedThreadPool(threadCount);

        for (int i = 0; i < threadCount; i++) {
            executor.submit(() -> {
                ready.countDown();
                try {
                    start.await();
                    MatchOfferResponse resp = matchService.accept(
                            request.getId(), guide.getId(), new AcceptRequest(null));
                    responses.add(resp);
                } catch (Exception e) {
                    errorCount.incrementAndGet();
                } finally {
                    done.countDown();
                }
            });
        }

        ready.await();
        start.countDown();
        boolean finished = done.await(30, TimeUnit.SECONDS);
        executor.shutdown();

        assertThat(finished).isTrue();
        assertThat(errorCount.get()).isEqualTo(0);
        assertThat(responses).hasSize(threadCount);
        assertThat(matchOfferRepository.findByRequestId(request.getId())).hasSize(1);

        Long firstId = responses.get(0).id();
        assertThat(responses).allMatch(r -> r.id().equals(firstId));
    }

    private User createUser(String email, String name, UserRole role) {
        User user = new User();
        user.setEmail(email);
        user.setPassword("$2a$10$dummyhashfortest000000000000000000000000000000000000000");
        user.setName(name);
        user.setRole(role);
        return userRepository.save(user);
    }

    private HelpRequest createRequest(Long travelerId) {
        HelpRequest request = new HelpRequest();
        request.setTravelerId(travelerId);
        request.setRequestType(RequestType.GUIDE);
        request.setLat(37.5665);
        request.setLng(126.9780);
        request.setDescription("Concurrency test request");
        request.setStartAt(LocalDateTime.now().plusHours(1));
        request.setDurationMin(60);
        request.setBudgetKrw(10000L);
        request.setStatus(HelpRequestStatus.OPEN);
        return helpRequestRepository.save(request);
    }

    private MatchOffer createOffer(Long requestId, Long guideId) {
        MatchOffer offer = new MatchOffer();
        offer.setRequestId(requestId);
        offer.setGuideId(guideId);
        offer.setStatus(MatchOfferStatus.PENDING);
        return matchOfferRepository.save(offer);
    }
}
