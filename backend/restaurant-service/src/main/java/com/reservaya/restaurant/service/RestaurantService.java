package com.reservaya.restaurant.service;

import com.reservaya.restaurant.dto.RestaurantRequest;
import com.reservaya.restaurant.dto.RestaurantResponse;
import com.reservaya.restaurant.entity.Restaurant;
import com.reservaya.restaurant.entity.RestaurantAdmin;
import com.reservaya.restaurant.entity.RestaurantAdminId;
import com.reservaya.restaurant.exception.AccessDeniedException;
import com.reservaya.restaurant.exception.DuplicateResourceException;
import com.reservaya.restaurant.exception.ResourceNotFoundException;
import com.reservaya.restaurant.repository.RestaurantAdminRepository;
import com.reservaya.restaurant.repository.RestaurantRepository;
import com.reservaya.restaurant.security.AuthenticatedUser;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Service
public class RestaurantService {

    private final RestaurantRepository restaurantRepository;
    private final RestaurantAdminRepository adminRepository;

    public RestaurantService(RestaurantRepository restaurantRepository,
                             RestaurantAdminRepository adminRepository) {
        this.restaurantRepository = restaurantRepository;
        this.adminRepository = adminRepository;
    }

    public List<RestaurantResponse> search(String name, String city, String cuisine) {
        return restaurantRepository.search(blankToEmpty(name), blankToEmpty(city), blankToEmpty(cuisine)).stream()
                .map(RestaurantResponse::from)
                .toList();
    }

    /** Filtro ausente = "": las consultas de búsqueda no aceptan null (ver BranchRepository.search). */
    static String blankToEmpty(String value) {
        return value == null ? "" : value.trim();
    }

    /** Restaurantes que administra el usuario (panel del administrador). */
    @Transactional(readOnly = true)
    public List<RestaurantResponse> getMine(AuthenticatedUser user) {
        return adminRepository.findByIdUserId(user.id()).stream()
                .map(admin -> RestaurantResponse.from(admin.getRestaurant()))
                .toList();
    }

    @Transactional
    public RestaurantResponse create(RestaurantRequest request, AuthenticatedUser user) {
        if (restaurantRepository.existsByNameIgnoreCase(request.getName().trim())) {
            throw new DuplicateResourceException("Ya existe un restaurante con ese nombre.");
        }

        Restaurant restaurant = new Restaurant();
        restaurant.setName(request.getName().trim());
        restaurant.setCuisineType(request.getCuisineType().trim());
        restaurant.setDescription(request.getDescription());
        restaurant.setLogoUrl(request.getLogoUrl());
        restaurant = restaurantRepository.save(restaurant);

        RestaurantAdmin admin = new RestaurantAdmin(user.id(), restaurant);
        adminRepository.save(admin);

        return RestaurantResponse.from(restaurant);
    }

    @Transactional
    public RestaurantResponse update(Long id, RestaurantRequest request, AuthenticatedUser user) {
        Restaurant restaurant = restaurantRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Restaurante no encontrado."));

        verifyAdmin(user, restaurant.getId());
        if (restaurantRepository.existsByNameIgnoreCaseAndIdNot(request.getName().trim(), id)) {
            throw new DuplicateResourceException("Ya existe un restaurante con ese nombre.");
        }

        restaurant.setName(request.getName().trim());
        restaurant.setCuisineType(request.getCuisineType().trim());
        restaurant.setDescription(request.getDescription());
        restaurant.setLogoUrl(request.getLogoUrl());

        return RestaurantResponse.from(restaurantRepository.save(restaurant));
    }

    public boolean isAdmin(Long userId, Long restaurantId) {
        return adminRepository.existsById(new RestaurantAdminId(userId, restaurantId));
    }

    public void verifyAdmin(AuthenticatedUser user, Long restaurantId) {
        if ("SYSTEM_ADMIN".equals(user.role())) return;
        if (!isAdmin(user.id(), restaurantId)) {
            throw new AccessDeniedException("No tienes permisos sobre este restaurante.");
        }
    }
}
