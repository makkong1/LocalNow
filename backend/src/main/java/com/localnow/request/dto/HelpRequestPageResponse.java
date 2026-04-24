package com.localnow.request.dto;

import java.util.List;

public record HelpRequestPageResponse(
        List<HelpRequestResponse> items,
        Long nextCursor
) {}
