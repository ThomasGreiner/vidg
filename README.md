vidg - the hot-or-not for stored videos
=======================================

[![Build Status](https://travis-ci.org/ThomasGreiner/vidg.svg?branch=master)](https://travis-ci.org/ThomasGreiner/vidg)

## What it does

1. Creates index and prepares preview images of all videos in file `.vidg.sqlite`
2. Creates local server and launches browser
3. Let's you rate videos from -1 (trash) to 5 (keep)

## Starting server

```
vidg [-h][-p <port>][-r <min-rating>][-s] <input>

-h Show usage
-p Server port (default: 8080)
-r Play media by rating
-s Start server
```

## Keyboard shortcuts

- **left:** go to previous video
- **right:** go to next video
- **CTRL + left:** go to previous unrated video
- **CTRL + right:** go to next unrated video
- **up:** increase rating of video
- **down:** decrease rating of video
- **enter:** open video in video player
- **n:** play next video (only while in fullscreen)
- **p:** play previous video (only while in fullscreen)

## Requirements

- Node.js 14

  ```
  apt-get install npm
  npm install -g n
  n stable
  npm install
  ```

- ffmpeg / ffprobe

  ```
  apt-add-repository ppa:jon-severinsson/ffmpeg
  apt-get update
  apt-get install ffmpeg
  ```

- node-canvas:

  ```
  apt-get install libcairo2-dev libjpeg8-dev libpango1.0-dev libgif-dev
  ```

### Optional

- Inspect database on the command line using SQLite3

  ```
  apt-get install sqlite3
  ```

## Tests

Run tests via `npm test` or `node test`.

## Scripts

### Audio x100

`audio100x.sh <filename> <extension>`

Create new file from existing file with 100-times amplified volume.

e.g. `audio100x.sh example mp4`

### Concatenate

`concat.js [-h] <directory>`

Create new file from files in given directory.

e.g. `concat.js ./example/`

### Cut

`cut.js [-h] <file> <start> <end>`

Create new file from existing file based on given time range.

e.g. `cut.js ./example.mp4 00:00:15 01:20:30`

### Strip audio

`strip-audio.js [-h] <file>`

Create new file from existing file but without audio channel.

e.g. `strip-audio.js ./example.mp4`
