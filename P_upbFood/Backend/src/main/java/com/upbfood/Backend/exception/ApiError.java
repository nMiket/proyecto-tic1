package com.upbfood.Backend.exception;

import java.time.Instant;

public record ApiError(int status, String message, Instant timestamp) {
}
