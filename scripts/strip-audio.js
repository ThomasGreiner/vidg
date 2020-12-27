#!/usr/bin/env node

"use strict";

const {spawn} = require("child_process");
const optimist = require("optimist");
const path = require("path");

const {argv} = optimist
    .usage("$0 <file>".yellow)
    .option("h", {
      alias: "help",
      description: "Show usage"
    })
    .check((argv) => {
      if (argv.help)
        throw "";
      
      if (argv._.length !== 1)
        throw "Wrong number of arguments";
    });
const [filepath] = argv._;

function getOutputFilepath(inputFilepath) {
  let {dir, name, ext} = path.parse(inputFilepath);
  return path.join(dir, `${name}.noaudio${ext}`);;
}

let ffmpeg = spawn("ffmpeg", [
  // restrict to single process
  "-threads", "1",
  // specify input file
  "-i", filepath,
  // no need to reencode
  "-codec", "copy",
  // no audio
  "-an",
  // specify output file
  getOutputFilepath(filepath)
]);

ffmpeg.stdout.on("data", (data) => console.log(data.toString("utf8")));
ffmpeg.stderr.on("data", (data) => console.error(data.toString("utf8")));
ffmpeg.on("close", () => {
  console.log("Finished", getOutputFilepath(filepath));
});
