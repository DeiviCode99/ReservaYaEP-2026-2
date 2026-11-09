package com.reservaya.restaurant.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public class RestaurantRequest {

    @NotBlank @Size(min = 2, max = 80)
    private String name;

    @NotBlank @Size(min = 2, max = 60)
    private String cuisineType;

    private String description;

    @Size(max = 512)
    private String logoUrl;

    public String getName() { return name; }
    public void setName(String name) { this.name = name; }

    public String getCuisineType() { return cuisineType; }
    public void setCuisineType(String cuisineType) { this.cuisineType = cuisineType; }

    public String getDescription() { return description; }
    public void setDescription(String description) { this.description = description; }

    public String getLogoUrl() { return logoUrl; }
    public void setLogoUrl(String logoUrl) { this.logoUrl = logoUrl; }
}
