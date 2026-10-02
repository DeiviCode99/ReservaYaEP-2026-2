package com.reservaya.reservation.repository;

import org.springframework.data.jpa.repository.JpaRepository;

import com.reservaya.reservation.entity.ReservationAudit;

public interface ReservationAuditRepository extends JpaRepository<ReservationAudit, Long> {
}