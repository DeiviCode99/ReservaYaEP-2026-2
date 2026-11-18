package com.reservaya.backend.repository;

import com.reservaya.backend.model.Credential;
import org.springframework.data.mongodb.repository.MongoRepository;

import java.util.Optional;

public interface CredentialRepository extends MongoRepository<Credential, String> {
    Optional<Credential> findByUserId(String userId);
}
