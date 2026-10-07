package com.reservaya.reservation.security;

public record AuthenticatedUser(Long id, String email, String role, String name) {

	public AuthenticatedUser(Long id, String email, String role) {
		this(id, email, role, null);
	}
}
