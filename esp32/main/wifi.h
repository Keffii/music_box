#pragma once
#include <stdbool.h>

/** Connects to the configured WiFi network and keeps reconnecting in the background. */
void wifi_start(void);
bool wifi_is_connected(void);
