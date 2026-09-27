package com.reservaya.auth.dto;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

/** Cuerpos de las peticiones de Google y de recuperación de cuenta. */
public final class AccountRequests {

    private AccountRequests() {
    }

    /** credential = ID token de Google; role solo se usa si la cuenta es nueva. */
    public record GoogleLogin(@NotBlank String credential, String role) {
    }

    public record ForgotPassword(@NotBlank @Email String email) {
    }

    public record ResetPassword(@NotBlank String token,
                                @NotBlank @Size(min = 8, max = 72) String password) {
    }
}
