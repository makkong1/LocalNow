package com.localnow.common;

public final class GeoUtils {

    private static final double KM_PER_DEGREE_LAT = 111.32;

    private GeoUtils() {}

    /** 중심점(lat, lng)에서 radiusKm 반경의 MBR(Minimum Bounding Rectangle)을 반환한다. */
    public static Mbr boundingBox(double lat, double lng, double radiusKm) {
        double latDelta = radiusKm / KM_PER_DEGREE_LAT;
        double lngDelta = radiusKm / (KM_PER_DEGREE_LAT * Math.cos(Math.toRadians(lat)));
        return new Mbr(lat - latDelta, lng - lngDelta, lat + latDelta, lng + lngDelta);
    }

    public record Mbr(double latMin, double lngMin, double latMax, double lngMax) {}
}
