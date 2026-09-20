package com.reservaya.auth.exception;

public class InvalidCredentialsException extends RuntimeException {
    public InvalidCredentialsException() {
        super("Correo o contraseña incorrectos.");
    }
}
