#pragma once
// Buttons (active low, internal pull-ups) and the volume potentiometer.

typedef enum {
    INPUT_PLAY_PAUSE,
    INPUT_NEXT,
    INPUT_PREV,
    INPUT_SEEK,
    INPUT_SEEK_END, // Next released after holding it to seek
    INPUT_SHUFFLE,
    INPUT_REPEAT,
    INPUT_VOLUME, // value = 0..100
} input_type_t;

typedef struct {
    input_type_t type;
    int value;
} input_event_t;

typedef void (*input_cb_t)(input_event_t ev);

/** Starts the input task. The callback runs on that task, so it must not block for long. */
void input_start(input_cb_t cb);
