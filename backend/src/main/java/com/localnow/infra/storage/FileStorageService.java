package com.localnow.infra.storage;

import com.localnow.config.FileStorageConfig;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.server.ResponseStatusException;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.Set;
import java.util.UUID;

@Service
public class FileStorageService {

    private static final Set<String> ALLOWED_IMAGE_EXTENSIONS = Set.of("jpg", "jpeg", "png", "webp");
    private static final long MAX_IMAGE_BYTES = 5 * 1024 * 1024L;   // 5 MB
    private static final long MAX_PDF_BYTES = 10 * 1024 * 1024L;    // 10 MB

    private final FileStorageConfig config;

    public FileStorageService(FileStorageConfig config) {
        this.config = config;
    }

    public String storeProfileImage(MultipartFile file) {
        String ext = extractExtension(file.getOriginalFilename()).toLowerCase();
        if (!ALLOWED_IMAGE_EXTENSIONS.contains(ext)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "허용되지 않는 이미지 형식입니다. 허용: jpg, jpeg, png, webp");
        }
        if (file.getSize() > MAX_IMAGE_BYTES) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "이미지 파일 크기는 5MB 이하여야 합니다.");
        }
        String filename = UUID.randomUUID() + "." + ext;
        save(file, config.getProfilesPath().resolve(filename));
        return "/files/profiles/" + filename;
    }

    public String storeCertification(MultipartFile file) {
        String ext = extractExtension(file.getOriginalFilename()).toLowerCase();
        if (!"pdf".equals(ext)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "자격증 파일은 PDF만 허용됩니다.");
        }
        if (file.getSize() > MAX_PDF_BYTES) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "PDF 파일 크기는 10MB 이하여야 합니다.");
        }
        String filename = UUID.randomUUID() + ".pdf";
        save(file, config.getCertificationsPath().resolve(filename));
        return "/files/certifications/" + filename;
    }

    public void delete(String fileUrl) {
        if (fileUrl == null || !fileUrl.startsWith("/files/")) {
            return;
        }
        // "/files/profiles/xxx.jpg" → uploads/profiles/xxx.jpg
        String relative = fileUrl.substring("/files/".length());
        Path target = Paths.get(config.getDir()).resolve(relative).normalize();
        try {
            Files.deleteIfExists(target);
        } catch (IOException e) {
            // 파일 삭제 실패는 업무 흐름을 중단시키지 않는다
        }
    }

    private void save(MultipartFile file, Path target) {
        try {
            Files.copy(file.getInputStream(), target);
        } catch (IOException e) {
            throw new ResponseStatusException(HttpStatus.INTERNAL_SERVER_ERROR,
                    "파일 저장에 실패했습니다.");
        }
    }

    private String extractExtension(String filename) {
        if (filename == null || !filename.contains(".")) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "파일 확장자가 없습니다.");
        }
        return filename.substring(filename.lastIndexOf('.') + 1);
    }
}
