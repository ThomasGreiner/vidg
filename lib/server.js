"use strict";

const Canvas = require("canvas");
const fs = require("fs");
const http = require("http");
const open = require("open");
const path = require("path");
const qs = require("querystring");
const url = require("url");

const utils = require("./utils");

const rootPath = path.dirname(require.main.filename);

const typesBinary = ["woff"];
const types = {
  css: "text/css",
  js: "application/javascript",
  ttf: "font/opentype",
  woff: "font/woff"
};

let currentIndex = 0;
let DIR = null;
let SYNC = null;

const colors = ["#FAA", "#FFF", "#EFE", "#DFD", "#CFC", "#BFB", "#AFA"];

function getStats(file) {
  let canvas = new Canvas(1040, 20);
  let ctx = canvas.getContext("2d");
  let totalSize = SYNC.files.reduce((result, file) => result + file.stats.size, 0);
  let byteWidth = 1040 / totalSize;
  let currentX = 0;
  for (let f of SYNC.files) {
    let width = byteWidth * f.stats.size;
    ctx.fillStyle = (f === file) ? "#FFA" : colors[f.rating + 1];
    ctx.fillRect(currentX, 0, width, 20);
    currentX += width;
  }
  
  return {
    hasPrev: currentIndex > 0,
    hasNext: currentIndex + 1 < SYNC.files.length,
    statusImage: canvas.toDataURL("image/png")
  };
}

function writeNextFile(resp, dir) {
  if (dir == "next") {
    if (currentIndex + 1 < SYNC.files.length) {
      currentIndex++;
    }
  } else if (dir == "prev") {
    if (currentIndex > 0) {
      currentIndex--;
    }
  } else if (currentIndex >= SYNC.files.length) {
    currentIndex = SYNC.files.length - 1;
  }
  let file = SYNC.files[currentIndex];
  
  let status = (file) ? 200 : 204;
  if (SYNC.files.length === 0)
    status = 404;
  resp.writeHead(status, {
    "Content-Type": "application/json"
  });
  if (status == 200) {
    resp.write(JSON.stringify({
      image: file.screenshot,
      name: file.name,
      rating: file.rating,
      stats: getStats(file)
    }));
  }
  resp.end();
}

function onRequest(req, resp) {
  let urlInfo = url.parse(req.url);
  let method = req.method;
  let urlpath = urlInfo.pathname;
  let params;
  
  switch (method) {
    case "GET":
      params = qs.parse(urlInfo.query);
      switch (urlpath) {
        case "/":
          // startpage
          fs.readFile(path.resolve(rootPath, "static/videos.htm"), "utf-8", (err, content) => {
            if (!err) {
              resp.writeHead(200, {
                "Content-Type": "text/html"
              });
              resp.write(content);
            }
            resp.end();
          });
          return;
        case "/empty-trash":
          SYNC.emptyTrash()
              .then(() => writeNextFile(resp, null))
              .catch((err) => {
                resp.writeHead(500);
                resp.end();
              });
          return;
        case "/current":
        case "/next":
        case "/prev":
          // video data
          writeNextFile(resp, urlpath.substr(1));
          return;
        default:
          // static resources
          if (urlpath.indexOf("/static/") === 0) {
            let absPath = path.resolve(rootPath, path.relative("/", urlpath));
            let ext = path.extname(absPath).substr(1);
            const isBinary = (typesBinary.indexOf(ext) > -1);
            fs.readFile(absPath, isBinary ? "utf-8" : null, (err, content) => {
              if (ext in types) {
                resp.writeHead(200, {
                  "Content-Type": types[ext]
                });
              }
              resp.write(content);
              resp.end();
            });
          } else {
            resp.end();
          }
          return;
      }
      break;
    case "POST":
      // video data
      params = "";
      req.on("data", (data) => params += data.toString());
      req.on("end", () => {
        params = qs.parse(params);
        
        let file = SYNC.files[currentIndex];
        let rating = file.rating;
        switch (urlpath) {
          case "/rate-up":
            if (rating < 5) {
              rating++;
            }
            break;
          case "/rate-down":
            if (rating > -1) {
              rating--;
            }
            break;
          case "/view":
            open(path.join(DIR, file.name));
            resp.writeHead(204);
            resp.end();
            return;
        }
        
        SYNC.update(file, "rating", rating)
            .then(() => {
              resp.writeHead(200);
              resp.write(JSON.stringify({
                image: file.screenshot,
                name: file.name,
                rating: file.rating,
                stats: getStats(file)
              }));
              resp.end();
            })
            .catch((err) => {
              resp.writeHead(500);
              resp.end();
            });
      });
      break;
  }
}

module.exports.createServer = createServer;
function createServer(options) {
  DIR = options.inputDir;
  SYNC = options.sync;
  
  http.createServer(onRequest).listen(8080);
  console.log("Server started at 127.0.0.1:8080".green);
  open("http://127.0.0.1:8080");
}
