package com.reservaya.reservation.config;

import org.springframework.boot.context.properties.ConfigurationProperties;

@ConfigurationProperties(prefix = "reservaya.reservations")
public class ReservationProperties {

    private int minHoursBeforeCancel = 2;

    public int getMinHoursBeforeCancel() { return minHoursBeforeCancel; }
    public void setMinHoursBeforeCancel(int minHoursBeforeCancel) { this.minHoursBeforeCancel = minHoursBeforeCancel; }
}
