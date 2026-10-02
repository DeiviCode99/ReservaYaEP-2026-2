package com.reservaya.reservation.entity;

import java.util.List;
import java.util.Set;

/**
 * Ciclo de vida de una reserva. Cada estado sabe si ocupa cupo y a qué
 * estados puede pasar, así esas reglas viven en un solo lugar:
 *
 * PENDING ──► CONFIRMED ──► COMPLETED
 *    │            │
 *    ├──► REJECTED (restaurante)
 *    └────────────┴──► CANCELLED (cliente)
 */
public enum ReservationStatus {
    PENDING,
    CONFIRMED,
    CANCELLED,
    REJECTED,
    COMPLETED;

    /** Estados que ocupan cupo en su franja. */
    public static List<ReservationStatus> activeStatuses() {
        return List.of(PENDING, CONFIRMED);
    }

    public boolean isActive() {
        return this == PENDING || this == CONFIRMED;
    }

    /** Transiciones que puede hacer el restaurante (RF-11). */
    public boolean canBeChangedByRestaurantTo(ReservationStatus next) {
        return switch (this) {
            case PENDING -> Set.of(CONFIRMED, REJECTED).contains(next);
            case CONFIRMED -> next == COMPLETED;
            default -> false;
        };
    }
}
