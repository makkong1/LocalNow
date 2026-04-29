package com.localnow.config;

import jakarta.annotation.PostConstruct;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.context.annotation.Configuration;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;

@Configuration
@ConfigurationProperties(prefix = "localnow.upload")
public class FileStorageConfig {

    private String dir = "./uploads";

    public String getDir() { return dir; }
    public void setDir(String dir) { this.dir = dir; }

    public Path getProfilesPath() {
        return Paths.get(dir, "profiles");
    }

    public Path getCertificationsPath() {
        return Paths.get(dir, "certifications");
    }

    @PostConstruct
    public void init() {
        try {
            Files.createDirectories(getProfilesPath());
            Files.createDirectories(getCertificationsPath());
        } catch (IOException e) {
            throw new IllegalStateException("업로드 디렉토리를 생성할 수 없습니다: " + dir, e);
        }
    }
}
