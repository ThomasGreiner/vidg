#!/usr/local/bin/node

var optimist = require("optimist");
var argv = optimist
  .usage("$0 [-h][-p <tags>][-s] -v <path to videos>")
  .options("h", {
    alias: "help",
    boolean: true,
    description: "show usage"
  })
  .options("p", {
    alias: "playlist",
    description: "create a .pls file from videos with the given tags",
    string: true
  })
  .options("s", {
    alias: "screenshots",
    boolean: true,
    description: "create screenshots for videos"
  })
  .options("v", {
    alias: "videos",
    demand: true,
    description: "path to video directory",
    string: true
  })
  .argv;
var colors = require("colors");

// print usage
if (argv.help) {
  console.log(optimist.help());
  process.exit();
}

// create screenshots from videos
if (argv.screenshots) {
  console.log("Creating screenshots");
  //require("util").exec("./lib/shot -n 9 -r 40% "+argv.videos+"/*");
  //...
  process.exit();
}

// create playlist from given categories
if (argv.playlist) {
  console.log("Creating playlist");
  //...
  process.exit();
}

// start server for video gallery UI
global.vidDir = argv.videos;

var server = require("./modules/server");
require("http").createServer(server.HttpServer).listen(8080);
console.log("Server started at 127.0.0.1:8080".green);
