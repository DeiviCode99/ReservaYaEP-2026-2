package com.reservaya.reservation.client;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.ParameterizedTypeReference;
import org.springframework.http.HttpHeaders;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientException;
import org.springframework.web.context.request.RequestContextHolder;
import org.springframework.web.context.request.ServletRequestAttributes;

import java.util.Collection;
import java.util.List;
import java.util.Map;
import java.util.function.Function;
import java.util.stream.Collectors;

/**
 * Nombre y correo de quien reservó, para el panel del restaurante. Los pide a
 * auth-service (dueño de los usuarios) reenviando el token del administrador.
 * Si auth-service no responde, la lista de reservas se muestra igual sin esos datos.
 */
@Component
public class UserClient {

    private static final Logger log = LoggerFactory.getLogger(UserClient.class);

    private final RestClient restClient;
    private final String authUrl;

    public UserClient(RestClient restClient, @Value("${reservaya.services.auth-url}") String authUrl) {
        this.restClient = restClient;
        this.authUrl = authUrl;
    }

    public Map<Long, UserSummary> findByIds(Collection<Long> ids) {
        if (ids.isEmpty()) return Map.of();
        try {
            List<UserSummary> users = restClient.get()
                    .uri(authUrl + "/internal/users?ids={ids}",
                            ids.stream().map(String::valueOf).collect(Collectors.joining(",")))
                    .header(HttpHeaders.AUTHORIZATION, currentAuthorization())
                    .retrieve()
                    .body(new ParameterizedTypeReference<>() {});
            return users == null ? Map.of()
                    : users.stream().collect(Collectors.toMap(UserSummary::id, Function.identity()));
        } catch (RestClientException e) {
            log.warn("No se pudieron obtener los datos de los clientes: {}", e.getMessage());
            return Map.of();
        }
    }

    private static String currentAuthorization() {
        var attributes = (ServletRequestAttributes) RequestContextHolder.getRequestAttributes();
        return attributes == null ? "" : String.valueOf(attributes.getRequest().getHeader(HttpHeaders.AUTHORIZATION));
    }

    public record UserSummary(Long id, String name, String email) {
    }
}
