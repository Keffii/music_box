package com.example.media_controller_iot.controller;

import com.example.media_controller_iot.security.CognitoJwtValidator;
import com.example.media_controller_iot.service.GuestClaimService;
import com.nimbusds.jwt.JWTClaimsSet;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;

@RestController
@RequestMapping("/api/account")
public class AccountController {

    private static final Logger log = LoggerFactory.getLogger(AccountController.class);
    /** Guest accounts are created by the frontend with this username prefix (frontend/src/utils/guest.ts) */
    private static final String GUEST_PREFIX = "guest-";

    private final CognitoJwtValidator jwtValidator;
    private final GuestClaimService guestClaimService;

    public AccountController(CognitoJwtValidator jwtValidator, GuestClaimService guestClaimService) {
        this.jwtValidator = jwtValidator;
        this.guestClaimService = guestClaimService;
    }

    /**
     * Called right after a guest signs in to (or creates) a real account. The body carries the guest
     * session's ID token, which proves the caller owned that guest session. The guest's playlists,
     * favourites and history move to the signed-in account.
     */
    @PostMapping("/claim-guest")
    public ResponseEntity<?> claimGuest(@RequestBody Map<String, String> body, Authentication authentication) {
        if (!(authentication != null && authentication.getPrincipal() instanceof Jwt jwt)) {
            return ResponseEntity.status(401).body(Map.of("error", "Not signed in"));
        }
        String userId = jwt.getSubject();
        if (isGuest(jwt.getClaimAsString("cognito:username"))) {
            return ResponseEntity.badRequest().body(Map.of("error", "Sign in to a real account first"));
        }

        String guestToken = body == null ? null : body.get("guestToken");
        if (guestToken == null || guestToken.isBlank()) {
            return ResponseEntity.badRequest().body(Map.of("error", "guestToken is required"));
        }

        JWTClaimsSet guest;
        try {
            guest = jwtValidator.validateToken(guestToken); // signature, expiry, this user pool and app client
        } catch (Exception e) {
            return ResponseEntity.status(403).body(Map.of("error", "The guest session is not valid"));
        }
        String guestUserId = guest.getSubject();
        Object guestName = guest.getClaim("cognito:username");
        if (!isGuest(guestName == null ? null : guestName.toString()) || guestUserId == null || guestUserId.equals(userId)) {
            return ResponseEntity.status(403).body(Map.of("error", "That is not a guest session"));
        }

        Map<String, Integer> moved = guestClaimService.moveGuestData(guestUserId, userId);
        log.info("Moved guest data {} to user {}: {}", guestUserId, userId, moved);
        return ResponseEntity.ok(moved);
    }

    private static boolean isGuest(String username) {
        return username != null && username.startsWith(GUEST_PREFIX);
    }
}
