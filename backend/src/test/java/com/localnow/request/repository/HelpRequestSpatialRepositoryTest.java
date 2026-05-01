package com.localnow.request.repository;

import java.time.LocalDateTime;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.testcontainers.containers.GenericContainer;
import org.testcontainers.containers.MySQLContainer;
import org.testcontainers.containers.RabbitMQContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;
import org.testcontainers.utility.DockerImageName;

import com.localnow.common.GeoUtils;
import com.localnow.request.domain.HelpRequest;
import com.localnow.request.domain.HelpRequestStatus;
import com.localnow.request.domain.RequestType;
import com.localnow.user.domain.User;
import com.localnow.user.domain.UserRole;
import com.localnow.user.repository.UserRepository;

@SpringBootTest
@Testcontainers(disabledWithoutDocker = true)
class HelpRequestSpatialRepositoryTest {

    // 서울 시청 기준 중심점
    private static final double CENTER_LAT = 37.5665;
    private static final double CENTER_LNG = 126.978;

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
    static void props(DynamicPropertyRegistry registry) {
        registry.add("spring.datasource.url", mysql::getJdbcUrl);
        registry.add("spring.datasource.username", mysql::getUsername);
        registry.add("spring.datasource.password", mysql::getPassword);
        registry.add("spring.data.redis.host", redis::getHost);
        registry.add("spring.data.redis.port", () -> redis.getMappedPort(6379));
        registry.add("spring.rabbitmq.host", rabbit::getHost);
        registry.add("spring.rabbitmq.port", () -> rabbit.getMappedPort(5672));
    }

    @Autowired
    private HelpRequestRepository helpRequestRepository;

    @Autowired
    private UserRepository userRepository;

    @AfterEach
    void cleanup() {
        helpRequestRepository.deleteAll();
        userRepository.deleteAll();
    }

    @Test
    void findNearbyOpen_returns_only_open_requests_within_radius() {
        User traveler = saveTraveler("traveler@test.com");

        // 3km 이내 OPEN 요청 2건
        saveRequest(traveler.getId(), 37.5700, 126.9790, HelpRequestStatus.OPEN);   // ~0.5km
        saveRequest(traveler.getId(), 37.5800, 126.9900, HelpRequestStatus.OPEN);   // ~1.7km

        // 3km 외부 OPEN 요청 1건 (약 10.7km 남쪽)
        saveRequest(traveler.getId(), 37.4700, 126.9780, HelpRequestStatus.OPEN);

        // MATCHED 상태 요청 1건 (3km 이내, 상태가 달라서 제외돼야 함)
        HelpRequest matched = saveRequest(traveler.getId(), 37.5665, 126.9780, HelpRequestStatus.OPEN);
        matched.toMatched();
        helpRequestRepository.save(matched);

        GeoUtils.Mbr mbr = GeoUtils.boundingBox(CENTER_LAT, CENTER_LNG, 3.0);
        List<HelpRequest> results = helpRequestRepository.findNearbyOpen(
                CENTER_LAT, CENTER_LNG,
                mbr.latMin(), mbr.lngMin(),
                mbr.latMax(), mbr.lngMax(),
                3000.0);

        assertThat(results).hasSize(2);
        assertThat(results).allMatch(r -> r.getStatus() == HelpRequestStatus.OPEN);
    }

    @Test
    void findNearbyOpen_excludes_far_request_and_non_open_status() {
        User traveler = saveTraveler("traveler2@test.com");

        // 반경 밖 요청
        saveRequest(traveler.getId(), 37.4700, 126.9780, HelpRequestStatus.OPEN);

        // MATCHED, IN_PROGRESS 상태 (반경 안이지만 OPEN 아님)
        HelpRequest matched = saveRequest(traveler.getId(), 37.5665, 126.9780, HelpRequestStatus.OPEN);
        matched.toMatched();
        helpRequestRepository.save(matched);

        GeoUtils.Mbr mbr = GeoUtils.boundingBox(CENTER_LAT, CENTER_LNG, 3.0);
        List<HelpRequest> results = helpRequestRepository.findNearbyOpen(
                CENTER_LAT, CENTER_LNG,
                mbr.latMin(), mbr.lngMin(),
                mbr.latMax(), mbr.lngMax(),
                3000.0);

        assertThat(results).isEmpty();
    }

    private User saveTraveler(String email) {
        User user = new User();
        user.setEmail(email);
        user.setPassword("pw");
        user.setName("Traveler");
        user.setRole(UserRole.TRAVELER);
        return userRepository.save(user);
    }

    private HelpRequest saveRequest(Long travelerId, double lat, double lng, HelpRequestStatus status) {
        HelpRequest r = new HelpRequest();
        r.setTravelerId(travelerId);
        r.setRequestType(RequestType.GUIDE);
        r.setLat(lat);
        r.setLng(lng);
        r.setStartAt(LocalDateTime.now().plusHours(1));
        r.setDurationMin(60);
        r.setBudgetKrw(30000L);
        r.setStatus(status);
        return helpRequestRepository.save(r);
    }
}
