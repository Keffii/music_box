#include "ssd1351.h"

#include "driver/gpio.h"
#include "driver/spi_master.h"
#include "freertos/FreeRTOS.h"
#include "freertos/task.h"
#include "esp_log.h"
#include "sdkconfig.h"

static const char *TAG = "ssd1351";
static spi_device_handle_t s_dev;

#define PIN_CLK CONFIG_MUSICBOX_PIN_OLED_CLK
#define PIN_DIN CONFIG_MUSICBOX_PIN_OLED_DIN
#define PIN_CS  CONFIG_MUSICBOX_PIN_OLED_CS
#define PIN_DC  CONFIG_MUSICBOX_PIN_OLED_DC
#define PIN_RST CONFIG_MUSICBOX_PIN_OLED_RST

// The whole frame goes out in chunks no bigger than this (bytes); a multiple of the row size.
#define CHUNK   (GFX_W * 2 * 16)

static esp_err_t send(bool data, const uint8_t *buf, size_t len)
{
    if (len == 0) return ESP_OK;
    gpio_set_level(PIN_DC, data ? 1 : 0);
    spi_transaction_t t = {
        .length = len * 8,
        .tx_buffer = buf,
    };
    return spi_device_polling_transmit(s_dev, &t);
}

static void cmd(uint8_t c, const uint8_t *args, size_t n)
{
    send(false, &c, 1);
    send(true, args, n);
}

#define CMD(c, ...) do { const uint8_t a_[] = {__VA_ARGS__}; cmd((c), a_, sizeof a_); } while (0)
#define CMD0(c) cmd((c), NULL, 0)

esp_err_t ssd1351_init(void)
{
    gpio_config_t io = {
        .pin_bit_mask = (1ULL << PIN_DC) | (1ULL << PIN_RST),
        .mode = GPIO_MODE_OUTPUT,
    };
    ESP_ERROR_CHECK(gpio_config(&io));

    spi_bus_config_t bus = {
        .mosi_io_num = PIN_DIN,
        .miso_io_num = -1,
        .sclk_io_num = PIN_CLK,
        .quadwp_io_num = -1,
        .quadhd_io_num = -1,
        .max_transfer_sz = CHUNK,
    };
    ESP_ERROR_CHECK(spi_bus_initialize(SPI3_HOST, &bus, SPI_DMA_CH_AUTO));

    spi_device_interface_config_t dev = {
        .clock_speed_hz = CONFIG_MUSICBOX_OLED_SPI_MHZ * 1000 * 1000,
        .mode = 0,
        .spics_io_num = PIN_CS,
        .queue_size = 2,
    };
    ESP_ERROR_CHECK(spi_bus_add_device(SPI3_HOST, &dev, &s_dev));

    // hardware reset
    gpio_set_level(PIN_RST, 1);
    vTaskDelay(pdMS_TO_TICKS(10));
    gpio_set_level(PIN_RST, 0);
    vTaskDelay(pdMS_TO_TICKS(20));
    gpio_set_level(PIN_RST, 1);
    vTaskDelay(pdMS_TO_TICKS(20));

    CMD(0xFD, 0x12);            // unlock driver IC
    CMD(0xFD, 0xB1);            // unlock commands A2, B1, B3, BB, BE, C1
    CMD0(0xAE);                 // display off
    CMD(0xB3, 0xF1);            // clock divider / oscillator
    CMD(0xCA, 0x5F);            // multiplex ratio: 96 rows
    // Remap: 65k colour, COM split, scan direction. 0x74 and 0x66 are the two orientations.
#if CONFIG_MUSICBOX_OLED_ROTATE_180
    CMD(0xA0, 0x66);
#else
    CMD(0xA0, 0x74);
#endif
    CMD(0x15, 0x00, 0x7F);      // columns 0..127
    CMD(0x75, 0x00, 0x5F);      // rows 0..95
    CMD(0xA1, 0x00);            // start line
    CMD(0xA2, 0x00);            // display offset
    CMD(0xB5, 0x00);            // GPIO
    CMD(0xAB, 0x01);            // internal VDD regulator
    CMD(0xB1, 0x32);            // phase length
    CMD(0xBE, 0x05);            // VCOMH
    CMD0(0xA6);                 // normal display (not inverted)
    CMD(0xC1, 0xC8, 0x80, 0xC8);// contrast A, B, C
    CMD(0xC7, 0x0F);            // master contrast (max)
    CMD(0xB4, 0xA0, 0xB5, 0x55);// segment low voltage
    CMD(0xB6, 0x01);            // second precharge
    CMD0(0xAF);                 // display on

    ESP_LOGI(TAG, "OLED ready (%d MHz SPI)", CONFIG_MUSICBOX_OLED_SPI_MHZ);
    return ESP_OK;
}

esp_err_t ssd1351_flush(const gfx_t *fb)
{
    CMD(0x15, 0x00, GFX_W - 1);
    CMD(0x75, 0x00, GFX_H - 1);
    CMD0(0x5C); // write RAM

    const uint8_t *p = (const uint8_t *)fb->px;
    size_t total = sizeof fb->px;
    for (size_t off = 0; off < total; off += CHUNK) {
        size_t n = total - off < CHUNK ? total - off : CHUNK;
        esp_err_t err = send(true, p + off, n);
        if (err != ESP_OK) return err;
    }
    return ESP_OK;
}
