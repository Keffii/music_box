package com.example.media_controller_iot.security;

import com.nimbusds.jose.JWSAlgorithm;
import com.nimbusds.jose.jwk.source.JWKSource;
import com.nimbusds.jose.jwk.source.JWKSourceBuilder;
import com.nimbusds.jose.proc.JWSKeySelector;
import com.nimbusds.jose.proc.JWSVerificationKeySelector;
import com.nimbusds.jose.proc.SecurityContext;
import com.nimbusds.jwt.JWTClaimsSet;
import com.nimbusds.jwt.proc.ConfigurableJWTProcessor;
import com.nimbusds.jwt.proc.DefaultJWTClaimsVerifier;
import com.nimbusds.jwt.proc.DefaultJWTProcessor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import java.net.URI;
import java.util.Set;

/**
 * Validates Cognito ID tokens: RS256 signature against the user pool's public keys,
 * expiry, issuer (this user pool), audience (this app client) and token_use=id.
 */
@Component
public class CognitoJwtValidator {

    private final ConfigurableJWTProcessor<SecurityContext> jwtProcessor;

    public CognitoJwtValidator(
            @Value("${aws.cognito.region}") String region,
            @Value("${aws.cognito.userPoolId}") String userPoolId,
            @Value("${aws.cognito.appClientId:}") String appClientId) throws Exception {

        if (userPoolId == null || userPoolId.isBlank()) {
            throw new IllegalStateException(
                    "AWS_COGNITO_USER_POOL_ID is not set. Add it to the Elastic Beanstalk environment properties.");
        }

        String issuer = String.format("https://cognito-idp.%s.amazonaws.com/%s", region, userPoolId);

        JWKSource<SecurityContext> keySource = JWKSourceBuilder
                .create(URI.create(issuer + "/.well-known/jwks.json").toURL())
                .cache(true)
                .retrying(true)
                .build();

        jwtProcessor = new DefaultJWTProcessor<>();
        JWSKeySelector<SecurityContext> keySelector =
                new JWSVerificationKeySelector<>(JWSAlgorithm.RS256, keySource);
        jwtProcessor.setJWSKeySelector(keySelector);

        // The frontend sends the ID token, whose "aud" is the app client ID
        JWTClaimsSet.Builder expected = new JWTClaimsSet.Builder()
                .issuer(issuer)
                .claim("token_use", "id");
        Set<String> audience = (appClientId == null || appClientId.isBlank()) ? null : Set.of(appClientId);
        jwtProcessor.setJWTClaimsSetVerifier(
                new DefaultJWTClaimsVerifier<>(audience, expected.build(), Set.of("sub", "exp", "iat"), null));
    }

    public JWTClaimsSet validateToken(String token) throws Exception {
        return jwtProcessor.process(token, null);
    }
}
