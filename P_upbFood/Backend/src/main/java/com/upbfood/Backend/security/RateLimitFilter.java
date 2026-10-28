package com.upbfood.Backend.security;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import java.time.Instant;
import java.util.ArrayDeque;
import java.util.Deque;
import java.util.concurrent.ConcurrentHashMap;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

@Component
public class RateLimitFilter extends OncePerRequestFilter {

    private final ConcurrentHashMap<String, Deque<Long>> buckets = new ConcurrentHashMap<>();

    @Override
    protected void doFilterInternal(
            HttpServletRequest request,
            HttpServletResponse response,
            FilterChain filterChain) throws ServletException, IOException {

        String method = request.getMethod();
        String uri = request.getRequestURI();

        RateRule rule = resolveRule(method, uri);
        if (rule != null) {
            String clientIp = extractClientIp(request);
            String key = rule.name() + ":" + clientIp;
            if (!allowRequest(key, rule.maxRequests(), rule.windowMillis())) {
                response.setStatus(HttpStatus.TOO_MANY_REQUESTS.value());
                response.setContentType(MediaType.APPLICATION_JSON_VALUE);
                response.setCharacterEncoding("UTF-8");
                response.getWriter().write(
                        "{\"status\":429,\"message\":\"Demasiadas solicitudes desde esta dirección. Espera un momento e inténtalo de nuevo.\",\"timestamp\":\""
                                + Instant.now() + "\"}");
                return;
            }
        }

        filterChain.doFilter(request, response);
    }

    private RateRule resolveRule(String method, String uri) {
        if (uri != null && uri.startsWith("/api/upb/")) {
            return new RateRule("panel-upb", 30, 60_000L);
        }
        if ("POST".equalsIgnoreCase(method)) {
            if ("/api/admin/login".equals(uri)) {
                return new RateRule("login", 10, 60_000L);
            }
            if ("/api/solicitudes-registro".equals(uri)) {
                return new RateRule("solicitud-registro", 5, 15 * 60_000L);
            }
            if ("/api/invitaciones/activar".equals(uri)) {
                return new RateRule("activar-invitacion", 10, 60_000L);
            }
        } else if ("GET".equalsIgnoreCase(method)) {
            if ("/api/pedidos/historial".equals(uri)) {
                return new RateRule("historial-cliente", 20, 60_000L);
            }
            if ("/api/pedidos/consulta".equals(uri) || "/api/pedidos/seguimiento/consulta".equals(uri)) {
                return new RateRule("consulta-pedido", 25, 60_000L);
            }
        }
        return null;
    }

    private boolean allowRequest(String key, int maxRequests, long windowMillis) {
        long now = System.currentTimeMillis();
        Deque<Long> timestamps = buckets.computeIfAbsent(key, k -> new ArrayDeque<>());
        synchronized (timestamps) {
            while (!timestamps.isEmpty() && now - timestamps.peekFirst() > windowMillis) {
                timestamps.pollFirst();
            }
            if (timestamps.size() >= maxRequests) {
                return false;
            }
            timestamps.addLast(now);
            return true;
        }
    }

    private String extractClientIp(HttpServletRequest request) {
        String forwarded = request.getHeader("X-Forwarded-For");
        if (forwarded != null && !forwarded.isBlank()) {
            return forwarded.split(",")[0].trim();
        }
        return request.getRemoteAddr() != null ? request.getRemoteAddr() : "unknown";
    }

    private record RateRule(String name, int maxRequests, long windowMillis) {}
}
