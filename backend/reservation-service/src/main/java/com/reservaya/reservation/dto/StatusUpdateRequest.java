package com.reservaya.reservation.dto;

import jakarta.validation.constraints.NotBlank;

public class StatusUpdateRequest {

    @NotBlank
    private String status;

    private String cancellationReason;

    public String getStatus() { return status; }
    public void setStatus(String status) { this.status = status; }

    public String getCancellationReason() { return cancellationReason; }
    public void setCancellationReason(String cancellationReason) { this.cancellationReason = cancellationReason; }
}
