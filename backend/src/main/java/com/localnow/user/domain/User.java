package com.localnow.user.domain;

import com.fasterxml.jackson.annotation.JsonIgnore;
import jakarta.persistence.*;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import java.math.BigDecimal;
import java.time.LocalDateTime;

@Entity
@Table(name = "users")
public class User {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, unique = true)
    private String email;

    @JsonIgnore
    /** null 이면 OAuth(예: Google) 전용 계정 */
    @Column(nullable = true)
    private String password;

    @Column(nullable = false)
    private String name;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private UserRole role;

    private String languages;

    private String city;

    @Column(name = "profile_image_url")
    private String profileImageUrl;

    @Column(name = "birth_year")
    private Short birthYear;

    @Column(name = "bio", columnDefinition = "TEXT")
    private String bio;

    @Column(name = "base_lat")
    private Double baseLat;

    @Column(name = "base_lng")
    private Double baseLng;

    @Column(name = "avg_rating", precision = 3, scale = 2)
    private BigDecimal avgRating = BigDecimal.ZERO;

    @Column(name = "rating_count")
    private Integer ratingCount = 0;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at", nullable = false)
    private LocalDateTime updatedAt;

    public User() {}

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }

    public String getEmail() { return email; }
    public void setEmail(String email) { this.email = email; }

    public String getPassword() { return password; }
    public void setPassword(String password) { this.password = password; }

    public String getName() { return name; }
    public void setName(String name) { this.name = name; }

    public UserRole getRole() { return role; }
    public void setRole(UserRole role) { this.role = role; }

    public String getLanguages() { return languages; }
    public void setLanguages(String languages) { this.languages = languages; }

    public String getCity() { return city; }
    public void setCity(String city) { this.city = city; }

    public BigDecimal getAvgRating() { return avgRating; }
    public void setAvgRating(BigDecimal avgRating) { this.avgRating = avgRating; }

    public Integer getRatingCount() { return ratingCount; }
    public void setRatingCount(Integer ratingCount) { this.ratingCount = ratingCount; }

    public String getProfileImageUrl() { return profileImageUrl; }
    public void setProfileImageUrl(String profileImageUrl) { this.profileImageUrl = profileImageUrl; }

    public Short getBirthYear() { return birthYear; }
    public void setBirthYear(Short birthYear) { this.birthYear = birthYear; }

    public String getBio() { return bio; }
    public void setBio(String bio) { this.bio = bio; }

    public LocalDateTime getCreatedAt() { return createdAt; }
    public LocalDateTime getUpdatedAt() { return updatedAt; }

    public Double getBaseLat() { return baseLat; }
    public void setBaseLat(Double baseLat) { this.baseLat = baseLat; }

    public Double getBaseLng() { return baseLng; }
    public void setBaseLng(Double baseLng) { this.baseLng = baseLng; }

    public void updateBaseLocation(double lat, double lng) {
        this.baseLat = lat;
        this.baseLng = lng;
    }

    public void updateProfile(String profileImageUrl, Short birthYear, String bio) {
        this.profileImageUrl = profileImageUrl;
        this.birthYear = birthYear;
        this.bio = bio;
    }
}
