idf_component_register(
    SRCS "main.c" "wifi.c" "api.c" "json_lite.c" "input.c" "ssd1351.c" "gfx.c" "font5x7.c" "ui.c"
    INCLUDE_DIRS "."
    PRIV_REQUIRES esp_wifi esp_netif esp_event nvs_flash esp_http_client esp_driver_gpio esp_driver_spi esp_adc esp_timer
)
