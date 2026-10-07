package com.reservaya.reservation.dto;

import java.time.LocalDate;
import java.time.LocalTime;

import jakarta.validation.constraints.FutureOrPresent;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;

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

    @NotBlank
    @Pattern(regexp = "NONE|ROMANTIC_DINNER|BIRTHDAY|WEDDING")
    private String event = "NONE";

    public Long getBranchId() { return branchId; }
    public void setBranchId(Long branchId) { this.branchId = branchId; }

    public LocalDate getReservationDate() { return reservationDate; }
    public void setReservationDate(LocalDate reservationDate) { this.reservationDate = reservationDate; }

    public LocalTime getReservationTime() { return reservationTime; }
    public void setReservationTime(LocalTime reservationTime) { this.reservationTime = reservationTime; }

    public Integer getPartySize() { return partySize; }
    public void setPartySize(Integer partySize) { this.partySize = partySize; }

    public String getEvent() { return event; }
    public void setEvent(String event) { this.event = event; }
}
