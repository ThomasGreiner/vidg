#!/usr/bin/env node

"use strict";

const {spawn} = require("child_process");
const optimist = require("optimist");
const path = require("path");

const {argv} = optimist
    .usage("$0 [-h] <file> <start> <end>".yellow)
    .option("h", {
      alias: "help",
      description: "Show usage"
    })
    .check((argv) => {
      if (argv.help)
        throw "";
      
      if (argv._.length !== 3)
        throw "Wrong number of arguments";
    });
const [filepath, start, end] = argv._;

function getOutputFilepath(inputFilepath, start, end) {
  let {dir, name, ext} = path.parse(inputFilepath);
  return path.join(dir, `${name}.cut-${start}-${end}${ext}`);;
}

// TODO: allow shortened syntax (e.g. 5:07 instead of 00:05:07)
function toSeconds(duration) {
  let [hours, minutes, seconds] = duration.split(":", 3).map((number) => parseInt(number, 10));
  console.log(hours, minutes, seconds);
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

let ffmpeg = spawn("ffmpeg", [
  // restrict to single process
  "-threads", "1",
  // seek to position
  "-ss", fromSeconds(toSeconds(start)),
  // specify input file
  "-i", filepath,
  // no need to reencode
  "-codec", "copy",
  // specify duration
  "-t", fromSeconds(toSeconds(end) - toSeconds(start)),
  // specify output file
  getOutputFilepath(filepath, start, end)
]);

ffmpeg.stdout.on("data", (data) => console.log(data.toString("utf8")));
ffmpeg.stderr.on("data", (data) => console.error(data.toString("utf8")));
ffmpeg.on("close", () => {
  console.log("Finished", getOutputFilepath(filepath, start, end));
});
