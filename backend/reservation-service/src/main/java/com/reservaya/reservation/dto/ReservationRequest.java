package com.reservaya.reservation.dto;

import jakarta.validation.constraints.*;
import java.time.LocalDate;
import java.time.LocalTime;

public class ReservationRequest {

    @NotNull
    private Long branchId;

    @NotNull
    @FutureOrPresent
    private LocalDate reservationDate;

    @NotNull
    private LocalTime reservationTime;

    @NotNull @Min(1) @Max(50)
    private Integer partySize;

    public Long getBranchId() { return branchId; }
    public void setBranchId(Long branchId) { this.branchId = branchId; }

    public LocalDate getReservationDate() { return reservationDate; }
    public void setReservationDate(LocalDate reservationDate) { this.reservationDate = reservationDate; }

    public LocalTime getReservationTime() { return reservationTime; }
    public void setReservationTime(LocalTime reservationTime) { this.reservationTime = reservationTime; }

    public Integer getPartySize() { return partySize; }
    public void setPartySize(Integer partySize) { this.partySize = partySize; }
}
