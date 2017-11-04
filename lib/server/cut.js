"use strict";

const {spawn} = require("child_process");
const path = require("path");

function getOutputFilepath(inputFilepath, start, end) {
  let {dir, name, ext} = path.parse(inputFilepath);
  return path.join(dir, `${name}.cut-${start}-${end}${ext}`);;
}

// TODO: allow shortened syntax (e.g. 5:07 instead of 00:05:07)
function toSeconds(duration) {
  let [hours, minutes, seconds] = duration.split(":", 3).map((number) => parseInt(number, 10));
  return hours * 3600 + minutes * 60 + seconds;
}

function pad(number) {
  return (number < 10) ? `0${number}` : `${number}`;
}

function fromSeconds(duration) {
  let seconds = duration % 60;
  let minutes = Math.floor(duration / 60) % 60;
  let hours = Math.floor(duration / 3600);
  return `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
}

function cut(filepath, start, end) {
  return new Promise((resolve, reject) => {
    // TODO: https://superuser.com/questions/554620/how-to-get-time-stamp-of-closest-keyframe-before-a-given-timestamp-with-ffmpeg
    let ffmpeg = spawn("ffmpeg", [
      // restrict to single process
      "-threads", "1",
      "-ss", fromSeconds(toSeconds(start) - 1),
      // specify input file
      "-i", filepath,
      // no need to reencode
      "-codec", "copy",
      // seek to position
      "-ss", fromSeconds(1),
      // specify duration
      "-t", fromSeconds(toSeconds(end) - toSeconds(start)),
      // specify output file
      getOutputFilepath(filepath, start, end)
    ]);

    // ffmpeg.stdout.on("data", (data) => console.log(data.toString("utf8")));
    // ffmpeg.stderr.on("data", (data) => console.error(data.toString("utf8")));
    ffmpeg.on("close", () => {
      console.log("Finished", getOutputFilepath(filepath, start, end));
      resolve();
    });
  });
}
exports.cut = cut;
