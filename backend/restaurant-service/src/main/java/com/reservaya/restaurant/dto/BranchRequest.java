package com.reservaya.restaurant.dto;

import jakarta.validation.Valid;
import jakarta.validation.constraints.*;
import java.math.BigDecimal;
import java.util.List;

public class BranchRequest {

    @NotBlank @Size(max = 80)
    private String name;

    @NotBlank @Size(max = 150)
    private String address;

    @NotBlank @Size(max = 80)
    private String city;

    @Size(max = 30)
    private String phone;

    private BigDecimal latitude;
    private BigDecimal longitude;

    @NotNull @Min(1) @Max(500)
    private Integer capacity;

    private Boolean active = true;

    @Valid
    private List<ScheduleRequest> schedules;

    public String getName() { return name; }
    public void setName(String name) { this.name = name; }

    public String getAddress() { return address; }
    public void setAddress(String address) { this.address = address; }

    public String getCity() { return city; }
    public void setCity(String city) { this.city = city; }

    public String getPhone() { return phone; }
    public void setPhone(String phone) { this.phone = phone; }

    public BigDecimal getLatitude() { return latitude; }
    public void setLatitude(BigDecimal latitude) { this.latitude = latitude; }

    public BigDecimal getLongitude() { return longitude; }
    public void setLongitude(BigDecimal longitude) { this.longitude = longitude; }

    public Integer getCapacity() { return capacity; }
    public void setCapacity(Integer capacity) { this.capacity = capacity; }

    public Boolean getActive() { return active; }
    public void setActive(Boolean active) { this.active = active; }

    public List<ScheduleRequest> getSchedules() { return schedules; }
    public void setSchedules(List<ScheduleRequest> schedules) { this.schedules = schedules; }
}
