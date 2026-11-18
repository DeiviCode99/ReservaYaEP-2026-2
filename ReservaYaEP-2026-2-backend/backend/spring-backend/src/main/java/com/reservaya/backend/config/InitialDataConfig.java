package com.reservaya.backend.config;

import com.reservaya.backend.model.Credential;
import com.reservaya.backend.model.Role;
import com.reservaya.backend.model.User;
import com.reservaya.backend.repository.CredentialRepository;
import com.reservaya.backend.repository.UserRepository;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.CommandLineRunner;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.crypto.password.PasswordEncoder;

@Configuration
public class InitialDataConfig {

    @Bean
    CommandLineRunner createInitialAdmin(
            UserRepository userRepository,
            CredentialRepository credentialRepository,
            PasswordEncoder passwordEncoder,
            @Value("${app.admin.email:}") String email,
            @Value("${app.admin.password:}") String password,
            @Value("${app.admin.name:System Administrator}") String name) {
        return args -> {
            if (email.isBlank() || password.isBlank()) {
                return;
            }
            String normalizedEmail = email.trim().toLowerCase();
            User admin = userRepository.findByEmailIgnoreCase(normalizedEmail).orElse(null);
            if (admin == null) {
                admin = userRepository.save(User.builder()
                        .name(name)
                        .email(normalizedEmail)
                        .role(Role.SYSTEM_ADMIN)
                        .active(true)
                        .build());
                credentialRepository.save(Credential.builder()
                        .userId(admin.getId())
                        .passwordHash(passwordEncoder.encode(password))
                        .build());
            }
        };
    }
}
