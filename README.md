Live Measure — local camera measurement

What this is
- Small single-page web app that uses your device camera to measure objects live.
- You can calibrate using a known-width reference (for example a credit card 85.6 mm wide) by drawing a box around it.
- Optionally, the app can auto-detect largest rectangular objects (like a phone) if OpenCV.js loads.

How to run
1. Open `index.html` in a modern browser that supports getUserMedia (Chrome, Edge, Firefox on mobile). For local file access, you may need to serve the folder with a simple HTTP server (recommended) because some browsers restrict camera on file://.

  Example (PowerShell):
  python -m http.server 8000; then open http://localhost:8000/index.html

2. Click "Start Camera" and allow camera permission.
3. Place a known-width reference in the frame and click "Calibrate (Draw reference)" then draw a rectangle around the reference. That sets mm per pixel.
4. Choose measurement mode: point-to-point (tap two points) or rectangle (draw a box). The overlay updates live.
5. To try automatic measurement, click "Auto-detect rectangle" (requires OpenCV.js; the page already attempts to load it from the official CDN).

Notes and assumptions
- This app uses a simple 2D pixel-per-mm calibration. It assumes the reference and measured object lie approximately in the same plane and distance from the camera. Depth or perspective will cause measurement errors.
- For best accuracy: put the reference and object side-by-side on a flat surface, keep the camera perpendicular to the plane, and use good lighting.

Next steps / improvements
- Add perspective correction using ArUco markers or multiple reference points.
- Add a calibration wizard to estimate focal length.
- Provide export/share of measurements.

License: MIT
