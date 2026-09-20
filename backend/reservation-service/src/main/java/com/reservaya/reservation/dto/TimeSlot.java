package com.reservaya.reservation.dto;

import java.time.LocalTime;

public record TimeSlot(LocalTime time, int available) {
}
