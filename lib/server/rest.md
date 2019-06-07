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
  - **string** [dir]
    - next
    - prev
  - **string** [type]
    - video
  - **boolean** [unrated=false]
- **POST** `/file/open`
- **PATCH** `/file/rating`
  - **string** direction
    - down
    - up

## List

- **PUT** `/list`
  - **string[]** [filter]
    - **number** [rating]
    - **string** [similar]
      - duration
      - size
    - **string** [filepath]
  - **string[]** [sort=rating:asc,size:desc]
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
  - **string[]** filter
    - **number** rating
      - -1

## Playlist

- **GET** `/playlist` - Retrieve playlist based on current list