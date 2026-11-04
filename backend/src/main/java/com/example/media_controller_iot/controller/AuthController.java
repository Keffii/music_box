package com.example.media_controller_iot.controller;

import com.example.media_controller_iot.models.AppUser;
import com.example.media_controller_iot.repository.AppUserRepository;
import com.example.media_controller_iot.security.JwtService;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.*;

import java.nio.charset.StandardCharsets;
import java.util.Map;
import java.util.Optional;
import java.util.regex.Pattern;

@RestController
@RequestMapping("/api/auth")
public class AuthController {

    private static final Pattern USERNAME = Pattern.compile("^[A-Za-z0-9_.-]{3,32}$");
    private static final int MIN_PASSWORD = 8;
    /** BCrypt only uses the first 72 bytes. */
    private static final int MAX_PASSWORD_BYTES = 72;

    private final AppUserRepository users;
    private final PasswordEncoder passwordEncoder;
    private final JwtService jwtService;
    /** Checked when the user does not exist, so both paths take about as long. */
    private final String dummyHash;

    public AuthController(AppUserRepository users, PasswordEncoder passwordEncoder, JwtService jwtService) {
        this.users = users;
        this.passwordEncoder = passwordEncoder;
        this.jwtService = jwtService;
        this.dummyHash = passwordEncoder.encode("not-a-real-password");
    }

    public record Credentials(String username, String password) {}

    @PostMapping("/register")
    public ResponseEntity<Map<String, Object>> register(@RequestBody Credentials body) {
        String username = body.username() == null ? "" : body.username().trim();
        String password = body.password() == null ? "" : body.password();

        if (!USERNAME.matcher(username).matches()) {
            return error(HttpStatus.BAD_REQUEST,
                    "Username must be 3-32 characters: letters, digits, dot, underscore or dash");
        }
        if (password.length() < MIN_PASSWORD
                || password.getBytes(StandardCharsets.UTF_8).length > MAX_PASSWORD_BYTES) {
            return error(HttpStatus.BAD_REQUEST, "Password must be 8-72 characters");
        }
        if (users.existsByUsernameIgnoreCase(username)) {
            return error(HttpStatus.CONFLICT, "That username is taken");
        }

        AppUser user;
        try {
            user = users.save(AppUser.builder()
                    .username(username)
                    .passwordHash(passwordEncoder.encode(password))
                    .build());
        } catch (DataIntegrityViolationException e) {
            return error(HttpStatus.CONFLICT, "That username is taken");
        }
        return ResponseEntity.status(HttpStatus.CREATED).body(session(user));
    }

    @PostMapping("/login")
    public ResponseEntity<Map<String, Object>> login(@RequestBody Credentials body) {
        String username = body.username() == null ? "" : body.username().trim();
        String password = body.password() == null ? "" : body.password();

        Optional<AppUser> user = users.findByUsernameIgnoreCase(username);
        String hash = user.map(AppUser::getPasswordHash).orElse(dummyHash);
        boolean matches = passwordEncoder.matches(password, hash);

        if (user.isEmpty() || !matches) {
            return error(HttpStatus.UNAUTHORIZED, "Wrong username or password");
        }
        return ResponseEntity.ok(session(user.get()));
    }

    @GetMapping("/me")
    public Map<String, Object> me(@AuthenticationPrincipal Jwt jwt) {
        return Map.of("userId", jwt.getSubject(), "username", jwt.getClaimAsString("username"));
    }

    private Map<String, Object> session(AppUser user) {
        return Map.of(
                "token", jwtService.issue(user),
                "userId", String.valueOf(user.getId()),
                "username", user.getUsername());
    }

    private static ResponseEntity<Map<String, Object>> error(HttpStatus status, String message) {
        return ResponseEntity.status(status).body(Map.of("error", message));
    }
}
