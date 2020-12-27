#!/usr/bin/env node

"use strict";

const {spawn} = require("child_process");
const fs = require("fs");
const optimist = require("optimist");
const path = require("path");

const {argv} = optimist
    .usage("$0 <dir>".yellow)
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
const [dir] = argv._;

const OUTPUT = "concat.mp4";

fs.readdir(dir, (err, files) => {
  if (err) {
    console.error(err);
    return;
  }
  
  files = files
    .filter((file) => file != OUTPUT)
    .filter((file) => /\.(?:mov|mp4)$/.test(file))
    .map((file) => path.join(dir, file));
  
  let inputs = files.map((file) => ["-i", file]);
  inputs = Array.prototype.concat.apply([], inputs);
  let streams = files.map((file, idx) => `[${idx}:v:0] [${idx}:a:0]`).join(" ");
  let filter = `${streams} concat=n=${files.length}:v=1:a=1 [v] [a]`;
  let output = path.join(dir, OUTPUT);
  
  // TODO: use melt instead
  // melt * -consumer avformat:test.mp4 acodec=libmp3lame vcodec=libx264
  
  // TODO: add images
  // https://stackoverflow.com/questions/43958438/merge-videos-and-images-using-ffmpeg
  let ffmpeg = spawn("ffmpeg", [
    // restrict to single process
    "-threads", 1,
    // specify input files
    ...inputs,
    // apply concatention
    "-filter_complex", filter,
    // use streams from filter for output
    "-map", "[v]",
    "-map", "[a]",
    // specify output file
    output
  ]);
  ffmpeg.stdout.on("data", (data) => console.log(data.toString("utf8")));
  ffmpeg.stderr.on("data", (data) => console.error(data.toString("utf8")));
  ffmpeg.on("close", () => {
    console.log("Finished", output);
  });
});
