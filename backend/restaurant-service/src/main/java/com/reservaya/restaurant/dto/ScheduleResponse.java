package com.reservaya.restaurant.dto;

import com.reservaya.restaurant.entity.Schedule;
import java.time.LocalTime;

public record ScheduleResponse(Long id, Short dayOfWeek, LocalTime openTime,
                                LocalTime closeTime, Boolean isClosed) {

    public static ScheduleResponse from(Schedule s) {
        return new ScheduleResponse(s.getId(), s.getDayOfWeek(),
                s.getOpenTime(), s.getCloseTime(), s.getIsClosed());
    }
}
