package com.reservaya.reservation.dto;

import java.util.List;

public class BranchInfoDto {

    private Long id;
    private Long restaurantId;
    private String name;
    private Integer capacity;
    private Boolean active;
    private List<ScheduleInfoDto> schedules;

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }

    public Long getRestaurantId() { return restaurantId; }
    public void setRestaurantId(Long restaurantId) { this.restaurantId = restaurantId; }

    public String getName() { return name; }
    public void setName(String name) { this.name = name; }

    public Integer getCapacity() { return capacity; }
    public void setCapacity(Integer capacity) { this.capacity = capacity; }

    public Boolean getActive() { return active; }
    public void setActive(Boolean active) { this.active = active; }

    public List<ScheduleInfoDto> getSchedules() { return schedules; }
    public void setSchedules(List<ScheduleInfoDto> schedules) { this.schedules = schedules; }
}
