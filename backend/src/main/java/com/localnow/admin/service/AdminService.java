package com.localnow.admin.service;

import java.util.EnumMap;
import java.util.List;
import java.util.Map;

import org.springframework.lang.NonNull;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.localnow.admin.dto.AdminSummaryResponse;
import com.localnow.request.domain.HelpRequestStatus;
import com.localnow.request.repository.HelpRequestRepository;
import com.localnow.user.repository.UserRepository;

import lombok.RequiredArgsConstructor;

@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class AdminService {

    private final UserRepository userRepository;
    private final HelpRequestRepository helpRequestRepository;

    @NonNull
    public AdminSummaryResponse getSummary() {
        List<Object[]> rows = helpRequestRepository.countGroupByStatus();
        Map<HelpRequestStatus, Long> counts = new EnumMap<>(HelpRequestStatus.class);
        for (Object[] row : rows) {
            counts.put((HelpRequestStatus) row[0], (Long) row[1]);
        }
        return new AdminSummaryResponse(
                userRepository.count(),
                counts.getOrDefault(HelpRequestStatus.OPEN, 0L),
                counts.getOrDefault(HelpRequestStatus.MATCHED, 0L),
                counts.getOrDefault(HelpRequestStatus.IN_PROGRESS, 0L),
                counts.getOrDefault(HelpRequestStatus.COMPLETED, 0L),
                counts.getOrDefault(HelpRequestStatus.CANCELLED, 0L));
    }
}
