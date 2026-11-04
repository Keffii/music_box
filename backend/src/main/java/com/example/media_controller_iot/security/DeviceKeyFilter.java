package com.example.media_controller_iot.security;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.lang.NonNull;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.List;

/**
 * Authenticates the ESP32 remote on {@code /api/device/**} with a shared key sent in the
 * {@code X-Device-Key} header. The key is compared in constant time. With no key configured, the
 * device API stays locked.
 */
public class DeviceKeyFilter extends OncePerRequestFilter {

    public static final String HEADER = "X-Device-Key";
    public static final String ROLE = "DEVICE";
    private static final Logger log = LoggerFactory.getLogger(DeviceKeyFilter.class);

    private final byte[] expected;

    public DeviceKeyFilter(String deviceKey) {
        this.expected = deviceKey == null ? new byte[0] : deviceKey.getBytes(StandardCharsets.UTF_8);
        if (expected.length == 0) {
            log.warn("DEVICE_KEY is empty: the ESP32 device API is disabled.");
        }
    }

    @Override
    protected boolean shouldNotFilter(@NonNull HttpServletRequest request) {
        return !request.getRequestURI().startsWith("/api/device/");
    }

    @Override
    protected void doFilterInternal(@NonNull HttpServletRequest request, @NonNull HttpServletResponse response,
                                    @NonNull FilterChain chain) throws ServletException, IOException {
        String provided = request.getHeader(HEADER);
        if (expected.length > 0 && provided != null
                && MessageDigest.isEqual(expected, provided.getBytes(StandardCharsets.UTF_8))) {
            var auth = new UsernamePasswordAuthenticationToken(
                    "esp32", null, List.of(new SimpleGrantedAuthority("ROLE_" + ROLE)));
            SecurityContextHolder.getContext().setAuthentication(auth);
        }
        chain.doFilter(request, response);
    }
}
