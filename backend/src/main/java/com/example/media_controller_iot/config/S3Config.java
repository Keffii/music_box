package com.example.media_controller_iot.config;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import software.amazon.awssdk.auth.credentials.AwsBasicCredentials;
import software.amazon.awssdk.auth.credentials.AwsCredentialsProvider;
import software.amazon.awssdk.auth.credentials.DefaultCredentialsProvider;
import software.amazon.awssdk.auth.credentials.StaticCredentialsProvider;
import software.amazon.awssdk.regions.Region;
import software.amazon.awssdk.services.s3.S3Client;

@Configuration
public class S3Config {

    @Value("${aws.accessKeyId:}")
    private String accessKeyId;

    @Value("${aws.secretKey:}")
    private String secretKey;

    @Value("${aws.region}")
    private String region;

    /**
     * On AWS, leave the access keys empty: the default provider chain then picks up
     * the Elastic Beanstalk instance role, so no long-lived keys are stored anywhere.
     * Static keys are only used when both are set (e.g. running on your own PC).
     */
    @Bean
    public S3Client s3Client() {
        AwsCredentialsProvider credentials = (accessKeyId.isBlank() || secretKey.isBlank())
                ? DefaultCredentialsProvider.create()
                : StaticCredentialsProvider.create(AwsBasicCredentials.create(accessKeyId, secretKey));

        return S3Client.builder()
                .region(Region.of(region))
                .credentialsProvider(credentials)
                .build();
    }
}
