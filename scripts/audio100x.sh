#!/bin/bash

ffmpeg -i "$1.$2" -filter:a "volume=100" -c:v copy "$1.audio100x.$2"
