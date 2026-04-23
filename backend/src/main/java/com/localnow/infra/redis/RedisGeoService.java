package com.localnow.infra.redis;

import org.springframework.data.geo.Circle;
import org.springframework.data.geo.Distance;
import org.springframework.data.geo.GeoResult;
import org.springframework.data.geo.GeoResults;
import org.springframework.data.geo.Metrics;
import org.springframework.data.geo.Point;
import org.springframework.data.redis.connection.RedisGeoCommands;
import org.springframework.data.redis.core.GeoOperations;
import org.springframework.data.redis.core.RedisTemplate;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.stream.Collectors;

@Service
public class RedisGeoService {

    private static final String GEO_KEY = "geo:guides";

    private final GeoOperations<String, String> geoOps;

    public RedisGeoService(RedisTemplate<String, String> redisTemplate) {
        this.geoOps = redisTemplate.opsForGeo();
    }

    public void addGuide(Long guideId, double lat, double lng) {
        // Redis GEO stores as (longitude, latitude)
        geoOps.add(GEO_KEY, new Point(lng, lat), String.valueOf(guideId));
    }

    public void removeGuide(Long guideId) {
        geoOps.remove(GEO_KEY, String.valueOf(guideId));
    }

    public List<Long> searchNearby(double lat, double lng, double radiusKm) {
        Circle circle = new Circle(new Point(lng, lat), new Distance(radiusKm, Metrics.KILOMETERS));
        GeoResults<RedisGeoCommands.GeoLocation<String>> results = geoOps.radius(GEO_KEY, circle);
        if (results == null) {
            return List.of();
        }
        return results.getContent().stream()
                .map(GeoResult::getContent)
                .map(loc -> Long.parseLong(loc.getName()))
                .collect(Collectors.toList());
    }
}
