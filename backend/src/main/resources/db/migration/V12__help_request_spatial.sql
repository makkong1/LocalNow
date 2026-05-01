-- 1. POINT STORED GENERATED 컬럼 추가
--    MySQL POINT(x, y) = POINT(longitude, latitude)
--    SRID 4326 = WGS84 지리 좌표계
ALTER TABLE help_requests
  ADD COLUMN location POINT NOT NULL
    GENERATED ALWAYS AS (ST_SRID(POINT(lng, lat), 4326)) STORED;

-- 2. R-tree SPATIAL INDEX 생성 (MBR 기반 O(log N) 검색 활성화)
CREATE SPATIAL INDEX idx_help_request_location ON help_requests (location);
