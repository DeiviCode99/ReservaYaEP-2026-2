package com.reservaya.reservation.exception;

/** El usuario está autenticado pero no tiene permiso sobre el recurso (403). */
public class ForbiddenException extends RuntimeException {
    public ForbiddenException(String message) {
        super(message);
    }
}
