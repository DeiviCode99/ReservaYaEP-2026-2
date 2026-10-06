package com.reservaya.reservation.repository;

import java.time.LocalDate;
import java.time.LocalTime;
import java.util.List;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import com.reservaya.reservation.entity.Reservation;
import com.reservaya.reservation.entity.ReservationStatus;

public interface ReservationRepository extends JpaRepository<Reservation, Long> {

    List<Reservation> findByUserIdOrderByReservationDateDescReservationTimeDesc(Long userId);

    List<Reservation> findByBranchIdAndReservationDate(Long branchId, LocalDate date);

    List<Reservation> findByBranchIdAndReservationDateAndStatusIn(
            Long branchId, LocalDate date, List<ReservationStatus> statuses);

    @Query("SELECT r FROM Reservation r " +
            "WHERE r.branchId = :branchId " +
            "AND (:fromDate IS NULL OR r.reservationDate >= :fromDate) " +
            "AND (:toDate IS NULL OR r.reservationDate <= :toDate) " +
            "AND (:status IS NULL OR r.status = :status) " +
            "ORDER BY r.reservationDate, r.reservationTime")
    List<Reservation> searchByBranchAndDateRange(@Param("branchId") Long branchId,
                                                         @Param("fromDate") LocalDate fromDate,
                                                         @Param("toDate") LocalDate toDate,
                                                         @Param("status") ReservationStatus status);

    @Query("SELECT COALESCE(SUM(r.partySize), 0) FROM Reservation r " +
           "WHERE r.branchId = :branchId AND r.reservationDate = :date " +
           "AND r.reservationTime = :time AND r.status IN :statuses")
    int sumPartySizeBySlot(@Param("branchId") Long branchId,
                           @Param("date") LocalDate date,
                           @Param("time") LocalTime time,
                           @Param("statuses") List<ReservationStatus> statuses);
}
