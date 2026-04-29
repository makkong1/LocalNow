package com.localnow.user.service;

import com.localnow.infra.storage.FileStorageService;
import com.localnow.user.domain.Certification;
import com.localnow.user.dto.CertificationResponse;
import com.localnow.user.repository.CertificationRepository;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;

@Service
@Transactional(readOnly = true)
public class CertificationService {

    private final CertificationRepository certificationRepository;
    private final FileStorageService fileStorageService;

    public CertificationService(CertificationRepository certificationRepository,
                                FileStorageService fileStorageService) {
        this.certificationRepository = certificationRepository;
        this.fileStorageService = fileStorageService;
    }

    @Transactional
    public CertificationResponse upload(Long guideId, String name, MultipartFile file) {
        String fileUrl = fileStorageService.storeCertification(file);

        Certification cert = new Certification();
        cert.setUserId(guideId);
        cert.setName(name);
        cert.setFileUrl(fileUrl);

        Certification saved = certificationRepository.save(cert);
        return toResponse(saved);
    }

    public List<CertificationResponse> list(Long guideId) {
        return certificationRepository.findByUserId(guideId).stream()
                .map(this::toResponse)
                .toList();
    }

    @Transactional
    public void delete(Long guideId, Long certId) {
        if (!certificationRepository.existsByIdAndUserId(certId, guideId)) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "접근 권한이 없습니다.");
        }
        Certification cert = certificationRepository.findById(certId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "자격증을 찾을 수 없습니다."));
        fileStorageService.delete(cert.getFileUrl());
        certificationRepository.deleteById(certId);
    }

    private CertificationResponse toResponse(Certification cert) {
        return new CertificationResponse(
                cert.getId(),
                cert.getName(),
                cert.getFileUrl(),
                cert.getUploadedAt()
        );
    }
}
