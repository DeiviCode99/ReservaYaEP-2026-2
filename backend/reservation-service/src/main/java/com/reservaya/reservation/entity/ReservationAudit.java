package com.reservaya.reservation.entity;

import java.time.OffsetDateTime;
import java.time.ZoneId;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.PrePersist;
import jakarta.persistence.Table;

@Entity
@Table(name = "reservation_audit")
public class ReservationAudit {

    private static final ZoneId ZONE = ZoneId.of("America/Bogota");

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "reservation_id", nullable = false)
    private Long reservationId;

    @Column(name = "actor_user_id", nullable = false)
    private Long actorUserId;

    @Column(name = "actor_role", nullable = false, length = 30)
    private String actorRole;

    @Column(nullable = false, length = 20)
    private String action;

    @Enumerated(EnumType.STRING)
    @Column(name = "previous_status", length = 20)
    private ReservationStatus previousStatus;

    @Enumerated(EnumType.STRING)
    @Column(name = "new_status", nullable = false, length = 20)
    private ReservationStatus newStatus;

    @Column(length = 255)
    private String details;

    @Column(name = "changed_at", nullable = false, updatable = false)
    private OffsetDateTime changedAt;

    @PrePersist
    protected void onCreate() {
        changedAt = OffsetDateTime.now(ZONE);
    }

    public Long getId() { return id; }
    public Long getReservationId() { return reservationId; }
    public Long getActorUserId() { return actorUserId; }
    public String getActorRole() { return actorRole; }
    public String getAction() { return action; }
    public ReservationStatus getPreviousStatus() { return previousStatus; }
    public ReservationStatus getNewStatus() { return newStatus; }
    public String getDetails() { return details; }
    public OffsetDateTime getChangedAt() { return changedAt; }

    public void setReservationId(Long reservationId) { this.reservationId = reservationId; }
    public void setActorUserId(Long actorUserId) { this.actorUserId = actorUserId; }
    public void setActorRole(String actorRole) { this.actorRole = actorRole; }
    public void setAction(String action) { this.action = action; }
    public void setPreviousStatus(ReservationStatus previousStatus) { this.previousStatus = previousStatus; }
    public void setNewStatus(ReservationStatus newStatus) { this.newStatus = newStatus; }
    public void setDetails(String details) { this.details = details; }
}