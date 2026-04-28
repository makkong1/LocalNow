package com.localnow.user.repository;

import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.transaction.annotation.Transactional;

import com.localnow.user.domain.User;

public interface UserRepository extends JpaRepository<User, Long> {
    Optional<User> findByEmail(String email);

    @Modifying
    @Transactional
    @Query("""
            update User u
            set u.avgRating = round((u.avgRating * u.ratingCount + :newRating) / (u.ratingCount + 1), 2),
                u.ratingCount = u.ratingCount + 1
            where u.id = :guideId
            """)
    int incrementRating(@Param("guideId") Long guideId, @Param("newRating") int newRating);
}
