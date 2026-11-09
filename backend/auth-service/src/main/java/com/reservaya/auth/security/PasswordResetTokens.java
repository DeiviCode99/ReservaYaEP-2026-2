package com.reservaya.auth.security;

import com.reservaya.auth.config.JwtProperties;
import com.reservaya.auth.entity.User;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import java.nio.charset.StandardCharsets;
import java.security.GeneralSecurityException;
import java.security.MessageDigest;
import java.time.Instant;
import java.util.Base64;
import java.util.Optional;

/**
 * Enlaces de recuperación de cuenta sin tabla en la base de datos.
 *
 * Token = "idUsuario.expiraEpoch.firma", con firma HMAC-SHA256 sobre el id, la
 * expiración y el hash ACTUAL de la contraseña. Al cambiar la contraseña el
 * hash cambia y el enlace deja de servir, así que es de un solo uso.
 */
@Component
public class PasswordResetTokens {

    private final SecretKeySpec key;
    private final long ttlSeconds;

    public PasswordResetTokens(JwtProperties jwtProperties,
                               @Value("${reservaya.reset.expiration-minutes:30}") long ttlMinutes) {
        // Prefijo propio: una firma de este tipo nunca coincide con una del JWT.
        this.key = new SecretKeySpec(("password-reset:" + jwtProperties.getSecret())
                .getBytes(StandardCharsets.UTF_8), "HmacSHA256");
        this.ttlSeconds = ttlMinutes * 60;
    }

    public String create(User user) {
        long expires = Instant.now().getEpochSecond() + ttlSeconds;
        return user.getId() + "." + expires + "." + sign(user, expires);
    }

    /** Id del usuario al que dice pertenecer el token (aún sin validar la firma). */
    public Optional<Long> userId(String token) {
        String[] parts = token.split("\\.");
        if (parts.length != 3) return Optional.empty();
        try {
            return Optional.of(Long.valueOf(parts[0]));
        } catch (NumberFormatException e) {
            return Optional.empty();
        }
    }

    public boolean matches(String token, User user) {
        String[] parts = token.split("\\.");
        if (parts.length != 3 || !parts[0].equals(String.valueOf(user.getId()))) return false;
        long expires;
        try {
            expires = Long.parseLong(parts[1]);
        } catch (NumberFormatException e) {
            return false;
        }
        if (Instant.now().getEpochSecond() > expires) return false;
        return MessageDigest.isEqual(
                sign(user, expires).getBytes(StandardCharsets.UTF_8),
                parts[2].getBytes(StandardCharsets.UTF_8));
    }

    private String sign(User user, long expires) {
        try {
            Mac mac = Mac.getInstance("HmacSHA256");
            mac.init(key);
            byte[] signature = mac.doFinal((user.getId() + "|" + expires + "|" + user.getPasswordHash())
                    .getBytes(StandardCharsets.UTF_8));
            return Base64.getUrlEncoder().withoutPadding().encodeToString(signature);
        } catch (GeneralSecurityException e) {
            throw new IllegalStateException("HmacSHA256 no disponible", e);
        }
    }
}
