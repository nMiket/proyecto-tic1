package com.upbfood.Backend.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.io.IOException;
import java.math.BigDecimal;
import java.net.URI;
import java.net.URLEncoder;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.UUID;
import java.util.stream.Collectors;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

@Service
public class StripeService {

    private final String secretKey;
    private final String frontendUrl;
    private final ObjectMapper objectMapper;
    private final HttpClient httpClient;

    public StripeService(
            @Value("${app.stripe.secret-key:}") String secretKey,
            @Value("${app.frontend.url:http://localhost:5173}") String frontendUrl,
            ObjectMapper objectMapper
    ) {
        this.secretKey = secretKey != null ? secretKey.trim() : "";
        this.frontendUrl = (frontendUrl != null && !frontendUrl.isBlank())
                ? frontendUrl.trim().replaceAll("/+$", "")
                : "http://localhost:5173";
        this.objectMapper = objectMapper;
        this.httpClient = HttpClient.newBuilder()
                .connectTimeout(Duration.ofSeconds(10))
                .build();
    }

    public boolean estaConfigurado() {
        return !secretKey.isBlank()
                && !secretKey.contains("tu_llave_aqui")
                && (secretKey.startsWith("sk_test_") || secretKey.startsWith("sk_live_"));
    }

    public Map<String, Object> crearSesionCheckout(
            Integer pedidoId,
            UUID codigoSeguimiento,
            String nombreRestaurante,
            BigDecimal total
    ) {
        if (!estaConfigurado()) {
            throw new ResponseStatusException(
                    HttpStatus.SERVICE_UNAVAILABLE,
                    "La llave STRIPE_SECRET_KEY no está configurada en el entorno."
            );
        }

        // En Stripe, COP es moneda de 2 decimales (centavos), por lo que $4.500 COP = 450000.
        // Stripe exige un mínimo equivalente a ~$0.50 USD (~$2.500 COP = 250000 centavos).
        long unitAmountCentavos = Math.max(
                250000L,
                total.multiply(BigDecimal.valueOf(100)).longValue()
        );

        String descripcionProducto = "Pedido #" + pedidoId + " · "
                + (nombreRestaurante != null && !nombreRestaurante.isBlank() ? nombreRestaurante : "UPB Food");

        String basePagoUrl = frontendUrl + "/pago?codigo=" + encode(codigoSeguimiento.toString())
                + "&pedidoId=" + encode(String.valueOf(pedidoId))
                + "&total=" + encode(total.toPlainString());

        String cancelUrl = basePagoUrl + "&stripe_cancelled=1";

        Map<String, String> formParams = new LinkedHashMap<>();
        formParams.put("mode", "payment");
        formParams.put("line_items[0][price_data][currency]", "cop");
        formParams.put("line_items[0][price_data][unit_amount]", String.valueOf(unitAmountCentavos));
        formParams.put("line_items[0][price_data][product_data][name]", descripcionProducto);
        formParams.put("line_items[0][quantity]", "1");
        formParams.put("client_reference_id", codigoSeguimiento.toString());
        formParams.put("metadata[pedido_id]", String.valueOf(pedidoId));
        formParams.put("metadata[codigo_seguimiento]", codigoSeguimiento.toString());

        String formBody = formParams.entrySet().stream()
                .map(e -> encode(e.getKey()) + "=" + encode(e.getValue()))
                .collect(Collectors.joining("&"))
                + "&success_url=" + encode(basePagoUrl + "&stripe_session_id=") + "{CHECKOUT_SESSION_ID}"
                + "&cancel_url=" + encode(cancelUrl);

        HttpRequest request = HttpRequest.newBuilder()
                .uri(URI.create("https://api.stripe.com/v1/checkout/sessions"))
                .timeout(Duration.ofSeconds(15))
                .header("Authorization", "Bearer " + secretKey)
                .header("Content-Type", "application/x-www-form-urlencoded")
                .POST(HttpRequest.BodyPublishers.ofString(formBody, StandardCharsets.UTF_8))
                .build();

        try {
            HttpResponse<String> response = httpClient.send(
                    request,
                    HttpResponse.BodyHandlers.ofString(StandardCharsets.UTF_8)
            );
            JsonNode json = objectMapper.readTree(response.body());

            if (response.statusCode() < 200 || response.statusCode() >= 300) {
                String stripeMessage = json.path("error").path("message").asText(
                        "No fue posible crear la sesión de pago en Stripe."
                );
                throw new ResponseStatusException(HttpStatus.BAD_GATEWAY, stripeMessage);
            }

            String sessionId = json.path("id").asText("");
            String checkoutUrl = json.path("url").asText("");
            if (sessionId.isBlank() || checkoutUrl.isBlank()) {
                throw new ResponseStatusException(
                        HttpStatus.BAD_GATEWAY,
                        "Stripe no devolvió una URL de pago válida."
                );
            }

            Map<String, Object> result = new LinkedHashMap<>();
            result.put("sessionId", sessionId);
            result.put("checkoutUrl", checkoutUrl);
            return result;
        } catch (IOException | InterruptedException ex) {
            if (ex instanceof InterruptedException) {
                Thread.currentThread().interrupt();
            }
            throw new ResponseStatusException(
                    HttpStatus.BAD_GATEWAY,
                    "Error de conexión con Stripe: " + ex.getMessage()
            );
        }
    }

    public boolean verificarSesionPagada(String sessionId) {
        if (!estaConfigurado() || sessionId == null || sessionId.isBlank()) {
            return false;
        }
        String cleanId = sessionId.trim();
        if (!cleanId.startsWith("cs_")) {
            throw new IllegalArgumentException("Identificador de sesión de Stripe inválido.");
        }

        HttpRequest request = HttpRequest.newBuilder()
                .uri(URI.create("https://api.stripe.com/v1/checkout/sessions/" + encode(cleanId)))
                .timeout(Duration.ofSeconds(15))
                .header("Authorization", "Bearer " + secretKey)
                .GET()
                .build();

        try {
            HttpResponse<String> response = httpClient.send(
                    request,
                    HttpResponse.BodyHandlers.ofString(StandardCharsets.UTF_8)
            );
            if (response.statusCode() < 200 || response.statusCode() >= 300) {
                return false;
            }
            JsonNode json = objectMapper.readTree(response.body());
            String paymentStatus = json.path("payment_status").asText("");
            String status = json.path("status").asText("");
            return "paid".equalsIgnoreCase(paymentStatus) || "complete".equalsIgnoreCase(status);
        } catch (IOException | InterruptedException ex) {
            if (ex instanceof InterruptedException) {
                Thread.currentThread().interrupt();
            }
            return false;
        }
    }

    private static String encode(String value) {
        return URLEncoder.encode(value, StandardCharsets.UTF_8);
    }
}

