# Music Box WiFi remote (ESP32, ESP-IDF)

A physical remote for the Music Box web player. Five buttons and a volume knob send commands over
WiFi, and a 1.27" colour OLED shows the current track, the play state, the volume and an animated
equalizer. Each press gets instant on-screen feedback.

The remote controls the same **shared player** as the website: Music Box has no accounts, so every
open browser and the remote are in sync. Press Next on the remote and the OLED and every open
website change song together; change the song or volume on the website and the OLED follows.

The firmware is plain C on **ESP-IDF v5.3 or newer** (no Arduino). Everything is set in `menuconfig`.

## Parts

- ESP32 dev board (ESP32-WROOM-32 / DevKitC or similar)
- Waveshare 1.27" RGB OLED module, 128x96, SSD1351 controller, SPI
- 5 momentary push buttons
- 10 kΩ linear potentiometer
- Breadboard and jumper wires

## Wiring

The buttons connect between the GPIO and **GND**. The firmware turns on the internal pull-ups, so
no resistors are needed.

| Function | ESP32 GPIO | Other side |
|---|---|---|
| Play / Pause | 26 | GND |
| Next | 25 | GND |
| Previous | 33 | GND |
| Mute | 32 | GND |
| Seek +10 s | 27 | GND |
| Potentiometer wiper (middle pin) | 34 | outer pins to 3V3 and GND |

| OLED pin | ESP32 |
|---|---|
| VCC | 3V3 |
| GND | GND |
| DIN | GPIO 23 (VSPI MOSI) |
| CLK | GPIO 18 (VSPI SCK) |
| CS | GPIO 5 |
| DC | GPIO 16 |
| RST | GPIO 17 |

GPIO 34 is input-only and on ADC1. ADC2 can't be used while WiFi is on, so the knob has to be on an
ADC1 pin (GPIO 32-39). All pins can be changed in `menuconfig`.

## Setup

1. Start Music Box on your computer: the backend with `mvnw spring-boot:run` in `backend/` (see the
   main README; the remote talks to it on port 8080), or `docker compose up --build`. Then find the
   computer's LAN IP address (`ipconfig` on Windows, `ip addr` on Linux, `ipconfig getifaddr en0` on
   macOS). Windows may ask to allow Java through the firewall: allow it on private networks.
2. Install ESP-IDF v5.3+ (see the [ESP-IDF Get Started guide](https://docs.espressif.com/projects/esp-idf/en/stable/esp32/get-started/)),
   or use Docker as shown below.
3. Configure the remote:

   ```bash
   cd esp32
   idf.py set-target esp32
   idf.py menuconfig
   ```

   Under **Music Box remote**, set:
   - **Network → WiFi SSID / password**: a 2.4 GHz network (the ESP32 has no 5 GHz radio)
   - **Network → Music Box URL**: `http://<your computer's IP>:8080`, with no trailing slash
   - **Network → Device key**: must match `DEVICE_KEY` on the backend (default `musicbox-demo-key`)
   - Pins, SPI speed, screen rotation and knob direction if your build differs

   The settings are saved to `sdkconfig`, which is git-ignored, so your WiFi password stays out of
   the repository.
4. Build and flash:

   ```bash
   idf.py build
   idf.py -p COM5 flash monitor     # or /dev/ttyUSB0 on Linux
   ```

### Building with Docker instead

```bash
docker run --rm -v "$PWD":/project -w /project espressif/idf:v5.3.2 idf.py set-target esp32 build
```

Flash the result with `idf.py flash` or [esptool](https://docs.espressif.com/projects/esptool/)
(Docker can't reach USB serial ports on Windows or macOS).

Make sure your computer's firewall allows incoming connections on port 8080 from the local network.
Otherwise the remote shows "Music Box unreachable".

## How it works

| Task | What it does |
|---|---|
| `input` | Scans the buttons every 5 ms (25 ms debounce) and reads the knob every 20 ms, smoothed. A volume change is sent only when the knob moves by at least 2 %, at most every 120 ms. The knob's position at boot is not sent, so restarting the remote doesn't reset the volume. |
| `net` | Sends queued commands to `POST /api/device/command` and otherwise polls `GET /api/device/state` every 500 ms over a keep-alive connection. WiFi power saving is off to keep latency low. |
| `ui` | Renders the screen at ~30 fps into a framebuffer in RAM and pushes it over SPI with DMA. |

Each press updates the screen right away (optimistic UI), and the backend's reply then confirms it.

Every request carries the shared key in the `X-Device-Key` header. You can try the same API with
curl:

```bash
curl -H "X-Device-Key: musicbox-demo-key" http://localhost:8080/api/device/state
curl -X POST -H "X-Device-Key: musicbox-demo-key" -H "Content-Type: application/json" \
     -d '{"command":"PLAY_PAUSE"}' http://localhost:8080/api/device/command
```

The commands are `PLAY`, `PAUSE`, `PLAY_PAUSE`, `NEXT`, `PREV`, `MUTE`, `SHUFFLE`, `REPEAT`,
`SEEK_FORWARD` and `VOLUME:<0-100>`.

## Previewing the screen on a PC

`ui.c`, `gfx.c` and `fonts_inter.c` don't depend on ESP-IDF, so the screens can be rendered on a computer:

```bash
cd esp32/tools
gcc -O2 -I../main render_preview.c ../main/ui.c ../main/gfx.c ../main/fonts_inter.c -o render_preview -lm
mkdir -p out && ./render_preview out && python ppm_sheet.py out preview.png 3
./render_preview --check   # every flash icon stays inside its circle and is centred
```

## Fonts

The screen uses [Inter](https://rsms.me/inter/) (SIL Open Font License, see
[`main/fonts/OFL-Inter.txt`](main/fonts/OFL-Inter.txt)), pre-rendered into anti-aliased bitmaps with
16 levels of coverage in [`main/fonts_inter.c`](main/fonts_inter.c): 9, 10 and 17 px for the text,
and 26 px digits for the volume overlay. The firmware only blends pixels and has no font engine.

That file is generated and committed, so building the firmware needs nothing extra. To change sizes
or weights, edit the list at the top of [`tools/make_fonts.py`](tools/make_fonts.py) and regenerate it:

```bash
pip install pillow
curl -L -o Inter.ttf "https://github.com/google/fonts/raw/main/ofl/inter/Inter%5Bopsz,wght%5D.ttf"
python tools/make_fonts.py Inter.ttf main
```

## Troubleshooting

- **Screen stays black**: check VCC/GND and the CS, DC and RST pins. Try a lower SPI speed in
  `menuconfig` (8 MHz) if the wires are long.
- **Image is upside down or mirrored**: toggle *Rotate the display 180 degrees*.
- **"Connecting to WiFi" never ends**: check the SSID and password, and that the network is 2.4 GHz.
- **"Music Box unreachable"**: check the URL (it must be the computer's LAN IP, not `localhost`), the
  firewall (allow Java on private networks), and that the backend is running: open
  `http://<LAN IP>:8080/api/player/state` from another device. The serial monitor logs a hint
  when the device key is wrong (HTTP 401/403).
- **Knob works backwards**: enable *Invert knob direction*.
