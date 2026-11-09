package com.reservaya.auth.security;

import com.reservaya.auth.exception.BadRequestException;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.ParameterizedTypeReference;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientException;

import java.util.Map;
import java.util.Set;

/**
 * Valida el ID token que entrega "Iniciar sesión con Google" en el navegador.
 * ponytail: usa el endpoint tokeninfo de Google (una llamada HTTP por login);
 * con mucho tráfico conviene verificar la firma localmente con sus JWKS.
 */
@Component
public class GoogleTokenVerifier {

    private static final String TOKENINFO_URL = "https://oauth2.googleapis.com/tokeninfo?id_token={token}";
    private static final Set<String> ISSUERS = Set.of("accounts.google.com", "https://accounts.google.com");

    private final RestClient restClient = RestClient.create();
    private final String clientId;

    public GoogleTokenVerifier(@Value("${reservaya.google.client-id:}") String clientId) {
        this.clientId = clientId.trim();
    }

    /** Vacío = Google deshabilitado; el frontend oculta el botón. */
    public String getClientId() {
        return clientId;
    }

    public GoogleUser verify(String idToken) {
        if (clientId.isEmpty()) {
            throw new BadRequestException("El inicio de sesión con Google no está habilitado.");
        }

        Map<String, Object> claims;
        try {
            // Google comprueba firma y expiración; si algo falla responde 400.
            claims = restClient.get().uri(TOKENINFO_URL, idToken)
                    .retrieve()
                    .body(new ParameterizedTypeReference<>() {});
        } catch (RestClientException e) {
            throw new BadRequestException("Google no pudo validar tu sesión. Intenta de nuevo.");
        }

        // El token debe ser para ESTA aplicación y el correo debe estar verificado.
        if (claims == null
                || !clientId.equals(claims.get("aud"))
                || !ISSUERS.contains(String.valueOf(claims.get("iss")))
                || !"true".equals(String.valueOf(claims.get("email_verified")))
                || claims.get("email") == null) {
            throw new BadRequestException("Google no pudo validar tu sesión. Intenta de nuevo.");
        }

        String email = claims.get("email").toString().trim().toLowerCase();
        Object name = claims.get("name");
        String displayName = name != null && name.toString().trim().length() >= 2
                ? name.toString().trim()
                : email.substring(0, email.indexOf('@'));
        return new GoogleUser(email, displayName.length() > 80 ? displayName.substring(0, 80) : displayName);
    }

    public record GoogleUser(String email, String name) {
    }
}
