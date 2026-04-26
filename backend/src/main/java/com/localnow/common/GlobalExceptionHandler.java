package com.localnow.common;

import java.util.List;
import java.util.stream.Collectors;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.server.ResponseStatusException;
import org.springframework.web.servlet.resource.NoResourceFoundException;

@RestControllerAdvice
public class GlobalExceptionHandler {

        private static final Logger log = LoggerFactory.getLogger(GlobalExceptionHandler.class);

        @ExceptionHandler(MethodArgumentNotValidException.class)
        public ResponseEntity<ApiResponse<?>> handleValidation(MethodArgumentNotValidException ex) {
                List<ApiResponse.FieldError> fields = ex.getBindingResult().getFieldErrors().stream()
                                .map(e -> new ApiResponse.FieldError(e.getField(), e.getDefaultMessage()))
                                .collect(Collectors.toList());
                return ResponseEntity.status(422)
                                .body(ApiResponse.fail(ErrorCode.VALIDATION_FAILED,
                                                ErrorCode.VALIDATION_FAILED.getDefaultMessage(), fields));
        }

        @ExceptionHandler(NoResourceFoundException.class)
        public ResponseEntity<ApiResponse<?>> handleNoResource(NoResourceFoundException ex) {
                if (log.isDebugEnabled()) {
                        log.debug("No static resource: {}", ex.getResourcePath());
                }
                return ResponseEntity.status(HttpStatus.NOT_FOUND)
                                .body(ApiResponse.fail(ErrorCode.NOT_FOUND,
                                                ErrorCode.NOT_FOUND.getDefaultMessage()));
        }

        @ExceptionHandler(ResponseStatusException.class)
        public ResponseEntity<ApiResponse<?>> handleResponseStatus(ResponseStatusException ex) {
                String message = ex.getReason() != null ? ex.getReason() : ex.getMessage();
                return ResponseEntity.status(ex.getStatusCode())
                                .body(ApiResponse.fail(ErrorCode.INTERNAL_ERROR, message));
        }

        @ExceptionHandler(AccessDeniedException.class)
        public ResponseEntity<ApiResponse<?>> handleAccessDenied(AccessDeniedException ex) {
                return ResponseEntity.status(HttpStatus.FORBIDDEN)
                                .body(ApiResponse.fail(ErrorCode.AUTH_FORBIDDEN,
                                                ErrorCode.AUTH_FORBIDDEN.getDefaultMessage()));
        }

        @ExceptionHandler(Exception.class)
        public ResponseEntity<ApiResponse<?>> handleGeneral(Exception ex) {
                log.error("Unhandled exception", ex);
                return ResponseEntity.status(500)
                                .body(ApiResponse.fail(ErrorCode.INTERNAL_ERROR,
                                                ErrorCode.INTERNAL_ERROR.getDefaultMessage()));
        }
}
