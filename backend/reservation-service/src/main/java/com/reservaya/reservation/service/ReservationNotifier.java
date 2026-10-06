package com.reservaya.reservation.service;

import com.reservaya.reservation.entity.Reservation;

public interface ReservationNotifier {
    void notifyCustomer(Reservation reservation, String subject, String message);
}