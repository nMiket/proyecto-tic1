package com.upbfood.Backend.exception;

import jakarta.validation.ConstraintViolationException;
import java.sql.SQLException;
import org.springframework.core.NestedExceptionUtils;
import org.springframework.dao.DataAccessException;
import org.springframework.web.bind.MissingServletRequestParameterException;
import org.springframework.dao.EmptyResultDataAccessException;
import java.time.Instant;
import java.util.stream.Collectors;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.server.ResponseStatusException;

@RestControllerAdvice
public class GlobalExceptionHandler {

    @ExceptionHandler(MethodArgumentNotValidException.class)
    public ResponseEntity<ApiError> handleValidation(MethodArgumentNotValidException exception) {
        String message = exception.getBindingResult().getFieldErrors().stream()
            .map(error -> error.getField() + ": " + error.getDefaultMessage())
            .collect(Collectors.joining(" "));
        return error(HttpStatus.BAD_REQUEST, message);
    }

    @ExceptionHandler(ConstraintViolationException.class)
    public ResponseEntity<ApiError> handleConstraintViolation(ConstraintViolationException exception) {
        return error(HttpStatus.BAD_REQUEST, exception.getMessage());
    }

    @ExceptionHandler(AccessDeniedException.class)
    public ResponseEntity<ApiError> handleAccessDenied(AccessDeniedException exception) {
        return error(HttpStatus.FORBIDDEN, exception.getMessage());
    }

    @ExceptionHandler(EmptyResultDataAccessException.class)
    public ResponseEntity<ApiError> handleNotFound(EmptyResultDataAccessException exception) {
        return error(HttpStatus.NOT_FOUND, "No se encontró el pedido solicitado.");
    }

    @ExceptionHandler(MissingServletRequestParameterException.class)
    public ResponseEntity<ApiError> handleMissingParameter(MissingServletRequestParameterException exception) {
        return error(HttpStatus.BAD_REQUEST, "Falta el parámetro obligatorio: " + exception.getParameterName() + ".");
    }

    /**
     * Las validaciones de negocio de las funciones PL/pgSQL (RAISE EXCEPTION, SQLSTATE P0001)
     * se devuelven como 400 con su mensaje; cualquier otro error de base de datos es 500.
     */
    @ExceptionHandler(DataAccessException.class)
    public ResponseEntity<ApiError> handleDataAccess(DataAccessException exception) {
        Throwable causa = NestedExceptionUtils.getMostSpecificCause(exception);
        if (causa instanceof SQLException sql && "P0001".equals(sql.getSQLState()) && sql.getMessage() != null) {
            String mensaje = sql.getMessage().lines().findFirst().orElse(sql.getMessage())
                    .replaceFirst("^ERROR:\\s*", "").trim();
            return error(HttpStatus.BAD_REQUEST, mensaje);
        }
        return error(HttpStatus.INTERNAL_SERVER_ERROR, "Ocurrió un error al procesar la solicitud.");
    }

    @ExceptionHandler(ResponseStatusException.class)
    public ResponseEntity<ApiError> handleResponseStatus(ResponseStatusException exception) {
        HttpStatus status = HttpStatus.resolve(exception.getStatusCode().value());
        if (status == null) {
            status = HttpStatus.BAD_REQUEST;
        }
        String message = exception.getReason() != null ? exception.getReason() : status.getReasonPhrase();
        return error(status, message);
    }

    @ExceptionHandler(IllegalArgumentException.class)
    public ResponseEntity<ApiError> handleIllegalArgument(IllegalArgumentException exception) {
        String message = exception.getMessage() != null ? exception.getMessage() : "Solicitud inválida.";
        String normalized = message.toLowerCase();
        if (normalized.contains("no encontrado") || normalized.contains("no existe")) {
            return error(HttpStatus.NOT_FOUND, message);
        }
        return error(HttpStatus.BAD_REQUEST, message);
    }

    @ExceptionHandler(IllegalStateException.class)
    public ResponseEntity<ApiError> handleIllegalState(IllegalStateException exception) {
        return error(HttpStatus.CONFLICT, exception.getMessage());
    }

    private ResponseEntity<ApiError> error(HttpStatus status, String message) {
        return ResponseEntity.status(status)
            .body(new ApiError(status.value(), message, Instant.now()));
    }
}
