vidg - the hot-or-not for stored videos
=======================================

## What it does

1. Creates index and prepares screenshots of all videos in file `.vidg.nedb`
2. Creates local server and launches browser
3. Let's you rate videos from -1 (trash) to 5 (keep)

## Starting server

```
vidg [-h][-m][-s] <input>

-h Show usage
-m Update meta data
-s Create screenshots
```

## Keyboard shortcuts

- **left:** go to previous video
- **right:** go to next video
- **up:** increase rating of video
- **down:** decrease rating of video
- **enter:** open video in video player

## Requirements

- Node.js (4.0+)

  ```
  sudo apt-get install npm
  sudo npm install n
  sudo n stable
  ```

- fluent-ffmpeg

  ```
  sudo apt-add-repository ppa:jon-severinsson/ffmpeg
  sudo apt-get update
  sudo apt-get install ffmpeg
  npm install fluent-ffmpeg
  ```

- node-canvas:

  ```
  sudo apt-get install libcairo2-dev libjpeg8-dev libpango1.0-dev libgif-dev
  npm install canvas
  ```

- Nedb

  `npm install nedb`

- trash

  `npm install trash`
