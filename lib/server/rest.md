# REST API

## GET

### Static

- /
- /static/

### Navigation

- /current
- /next
- /next-unrated
- /prev
- /prev-unrated

### Video

- /video
  - **string** id

### Playlists

- /playlist/all.m3u8
- /playlist/videos.m3u8

### Filter list

- /filter
- /filter-rating
  - **number|"any"** value
- /filter-sameduration
  - **boolean** [value]
- /filter-samesize
  - **boolean** [value]
- /filter-search
  - **string** [value]

### Sort list

- /sort
  - **string** value
    - random
    - *-asc
    - *-desc

## POST

- /empty-trash
- /rate-down
- /rate-up
- /view
- /view-all
