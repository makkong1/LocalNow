package com.localnow.request.infra;

import com.localnow.infra.redis.RedisGeoService;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.data.redis.connection.RedisStandaloneConfiguration;
import org.springframework.data.redis.connection.lettuce.LettuceConnectionFactory;
import org.springframework.data.redis.core.RedisTemplate;
import org.springframework.data.redis.serializer.StringRedisSerializer;
import org.testcontainers.containers.GenericContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;
import org.testcontainers.utility.DockerImageName;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

@Testcontainers(disabledWithoutDocker = true)
class MatchDispatcherIT {

    @Container
    static GenericContainer<?> redis = new GenericContainer<>(DockerImageName.parse("redis:7-alpine"))
            .withExposedPorts(6379);

    private static LettuceConnectionFactory factory;
    private static RedisTemplate<String, String> template;
    private static RedisGeoService redisGeoService;

    @BeforeAll
    static void setUpRedis() {
        RedisStandaloneConfiguration config = new RedisStandaloneConfiguration(
                redis.getHost(), redis.getMappedPort(6379));
        factory = new LettuceConnectionFactory(config);
        factory.afterPropertiesSet();

        template = new RedisTemplate<>();
        template.setConnectionFactory(factory);
        template.setKeySerializer(new StringRedisSerializer());
        template.setValueSerializer(new StringRedisSerializer());
        template.afterPropertiesSet();

        redisGeoService = new RedisGeoService(template);
    }

    @AfterAll
    static void tearDownRedis() {
        factory.destroy();
    }

    @BeforeEach
    void cleanup() {
        template.delete("geo:guides");
    }

    @Test
    void searchNearby_returns_guide_within_radius() {
        redisGeoService.addGuide(100L, 37.5665, 126.9780);

        List<Long> result = redisGeoService.searchNearby(37.5665, 126.9780, 5.0);

        assertThat(result).contains(100L);
    }

    @Test
    void searchNearby_excludes_guide_outside_radius() {
        // 서울 (37.5665, 126.9780) 에서 5km 반경
        // 수원 (37.2636, 127.0286) 은 약 33km 거리 → 반경 밖
        redisGeoService.addGuide(200L, 37.2636, 127.0286);

        List<Long> result = redisGeoService.searchNearby(37.5665, 126.9780, 5.0);

        assertThat(result).doesNotContain(200L);
    }

    @Test
    void searchNearby_returns_empty_when_no_guides_registered() {
        List<Long> result = redisGeoService.searchNearby(37.5665, 126.9780, 5.0);

        assertThat(result).isEmpty();
    }

    @Test
    void removeGuide_makes_guide_unfindable() {
        redisGeoService.addGuide(300L, 37.5665, 126.9780);
        redisGeoService.removeGuide(300L);

        List<Long> result = redisGeoService.searchNearby(37.5665, 126.9780, 5.0);

        assertThat(result).doesNotContain(300L);
    }
}
