package com.localnow.user.service;

import java.util.Optional;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import com.localnow.user.dto.BaseLocationResponse;
import com.localnow.user.repository.UserRepository;

import lombok.RequiredArgsConstructor;

import org.springframework.http.HttpStatus;

@Service
@Transactional
@RequiredArgsConstructor
public class GuideProfileService {

    private final UserRepository userRepository;

    public void saveBaseLocation(Long guideId, double lat, double lng) {
        userRepository.findById(guideId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Guide not found"))
                .updateBaseLocation(lat, lng);
    }

    @Transactional(readOnly = true)
    public Optional<BaseLocationResponse> getBaseLocation(Long guideId) {
        return userRepository.findById(guideId)
                .filter(u -> u.getBaseLat() != null && u.getBaseLng() != null)
                .map(u -> new BaseLocationResponse(u.getBaseLat(), u.getBaseLng()));
    }
}
