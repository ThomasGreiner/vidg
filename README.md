vidg - the hot-or-not for stored videos
=======================================

[![Build Status](https://travis-ci.org/ThomasGreiner/vidg.svg?branch=master)](https://travis-ci.org/ThomasGreiner/vidg)

## What it does

1. Creates index and prepares preview images of all videos in file `.vidg.sqlite`
2. Creates local server and launches browser
3. Let's you rate videos from -1 (trash) to 5 (keep)

## Starting server

```
vidg [-h][-p <port>][-r <min-rating>][-s][-u|-U] <input>

-h Show usage
-p Server port (default: 8080)
-r Play media by rating
-s Start server
-u Update meta data and previews
-U Force update meta data and previews (overwrite existing)
```

## Keyboard shortcuts

- **left:** go to previous video
- **right:** go to next video
- **CTRL + left:** go to previous unrated video
- **CTRL + right:** go to next unrated video
- **up:** increase rating of video
- **down:** decrease rating of video
- **enter:** open video in video player

## Requirements

- Node.js (6.0+)

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
