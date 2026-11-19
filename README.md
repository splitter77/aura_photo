# Aura Photo

A dependency-free web camera app (HTML/CSS/JS) styled after the iPhone Camera app, built on [AuraKit](https://github.com/splitter77/aura_framework) for Aura Browser and the AuraClip App Clip.
The interface is in French.

## Features

- Live camera preview in a 3:4 viewfinder, with front/back camera switching
- Photo, Video and Portrait modes (Portrait adds a slight color boost and a vignette)
- Zoom: 1× / 2× buttons and pinch-to-zoom from 1× to 8×
- Flash: uses the torch on the back camera when available, otherwise flashes the screen white
- Tap to focus (visual indicator), swipe to change mode
- Synthesized shutter sound and haptic feedback (through AuraKit)
- Video recording with a timer (MediaRecorder)
- Gallery to browse and delete shots
- Simulation mode with an animated fake scene when no camera is available

Shutter shortcuts: Space, Enter or the volume-up key.

## What happens when you take a photo

1. Haptic tap, then the torch turns on for 350 ms if the flash is on.
2. Shutter animation on the viewfinder and a synthesized "click-clack" sound.
3. The frame is cropped to what the viewfinder shows (3:4, current zoom, mirrored on the front camera), capped at 2400 px and exported as a JPEG (quality 0.92).
4. The photo is added to the gallery and the thumbnail updates.

Photos and videos are kept in memory only: nothing is saved or uploaded, and they are lost when the page reloads.

## Known limitations

- Flash "auto" behaves like "off".
- The Live Photo button toggles but has no effect on capture.
- PRO and PLUS modes are not simulated.

## Run locally

```bash
python -m http.server 8771
```

Then open http://localhost:8771. Camera access requires `localhost` or HTTPS.

## Files

- `index.html`: layout
- `style.css`: styles
- `app.js`: camera, capture, modes, gestures, gallery
- `lib/aurakit.js`: AuraKit (haptics, camera, torch)
