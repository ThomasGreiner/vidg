# REST API

- [Static](#static)
- [List](#list)
- [Playlist](#playlist)
- [Video](#video)

## Static

- **GET** `/`
- **GET** `/static/*`

## File

- **GET** `/file`
  - **string** [id] - Passed for unique URL when requesting video
  - **string** [dir]
    - next
    - prev
  - **string** [type]
    - video
  - **boolean** [unrated=false]
- **POST** `/file/open`
- **PATCH** `/file/rating`
  - **string** dir
    - down
    - up

## List

- **PUT** `/list`
  - **Object** [filter]
    - **number** [rating]
    - **boolean** [samecolors]
    - **boolean** [sameduration]
    - **boolean** [samesize]
    - **string** [text]
  - **Object[]** [sort=[rating:asc,size:desc]]
    - **string** key
      - bitrate
      - created
      - duration
      - random
      - rating
      - size
    - **string** dir
      - asc
      - desc
- **DELETE** `/list`
  - **number** rating
    - -1

## Playlist

- **GET** `/playlist` - Retrieve playlist (m3u8) based on current list
