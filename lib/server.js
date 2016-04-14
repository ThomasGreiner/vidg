"use strict";

const Canvas = require("canvas");
const fs = require("fs");
const http = require("http");
const open = require("open");
const path = require("path");
const qs = require("querystring");
const url = require("url");

const rootPath = path.dirname(require.main.filename);
const typesBinary = ["woff"];
const types = {
  css: "text/css",
  js: "application/javascript",
  ttf: "font/opentype",
  woff: "font/woff"
};
const colors = ["#D88", "#FFF", "#DED", "#CDC", "#ADA", "#8D8", "#6D6"];
const statsWidth = 1000;
const statsHeight = 20;

function getParams(req) {
  return new Promise((resolve, reject) => {
    switch (req.method) {
      case "GET": {
        let urlInfo = url.parse(req.url);
        let params = qs.parse(urlInfo.query);
        resolve(params);
        break;
      }
      case "POST": {
        let params = "";
        req.on("data", (data) => params += data.toString());
        req.on("end", () => {
          params = qs.parse(params);
          resolve(params);
        });
        req.on("error", reject);
        break;
      }
      default: {
        reject();
      }
    }
  });
}

class Server {
  constructor(db) {
    this._db = db;
  }
  
  start() {
    this._currentIndex = 0;
    return this._db.fileIndex.then((fileIndex) => {
      this._fileIndex = fileIndex;
    });
  }
  
  onRequest(req, resp) {
    getParams(req)
        .then((params) => this._handleRequest(req, params))
        .then((data) => {
          resp.writeHead(data.status, {
            "Content-Type": data.type || "text/plain"
          });
          if ("content" in data) {
            resp.write(data.content);
          }
          resp.end();
        })
        .catch((err) => {
          if (err instanceof Error) {
            console.error(err.stack);
            err = null;
          }
          resp.writeHead(err || 500);
          resp.end();
        });
  }
  
  _handleRequest(req, params) {
    return new Promise((resolve, reject) => {
      let urlpath = url.parse(req.url).pathname;
      switch (req.method) {
        case "GET": {
          switch (urlpath) {
            case "/": {
              // startpage
              let filepath = path.resolve(rootPath, "static/videos.htm");
              fs.readFile(filepath, "utf-8", (err, content) => {
                if (err) {
                  reject(err);
                } else {
                  resolve({
                    content,
                    status: 200,
                    type: "text/html"
                  });
                }
              });
              break;
            }
            case "/empty-trash": {
              let result = this._db.emptyTrash()
                  .then(() => this.start())
                  .then(() => this._getFile("current"));
              resolve(result);
              break;
            }
            case "/current":
            case "/prev":
            case "/next":
            case "/next-unrated": {
              resolve(this._getFile(urlpath.substr(1)));
              break;
            }
            default: {
              if (urlpath.indexOf("/static/") == -1) {
                reject(404);
                return;
              }
              
              let absPath = path.resolve(rootPath, path.relative("/", urlpath));
              let ext = path.extname(absPath).substr(1);
              const isBinary = (typesBinary.indexOf(ext) > -1);
              fs.readFile(absPath, isBinary ? "utf-8" : null, (err, content) => {
                if (!err && ext in types) {
                  resolve({
                    content,
                    status: 200,
                    type: types[ext]
                  });
                } else {
                  reject(404);
                }
              });
            }
          }
          break;
        }
        case "POST": {
          let fileEntry = this._fileIndex[this._currentIndex];
          let result = this._db.get(fileEntry.id)
              .then((file) => {
                let rating = file.rating;
                switch (urlpath) {
                  case "/rate-up": {
                    if (rating < 5) {
                      rating++;
                    }
                    break;
                  }
                  case "/rate-down": {
                    if (rating > -1) {
                      rating--;
                    }
                    break;
                  }
                  case "/view": {
                    open(file.path, "vlc");
                    return {status: 204};
                  }
                }
                
                return this._db.setRating(file.id, rating)
                    .then(() => fileEntry.rating = rating);
              })
              .then(() => this._getFile("current"));
          resolve(result);
        }
      }
    });
  }
  
  _getFile(dir) {
    dir = dir.split("-");
    switch (dir[0]) {
      case "current": {
        if (this._currentIndex >= this._fileIndex.length) {
          this._currentIndex = this._fileIndex.length - 1;
        }
        break;
      }
      case "next": {
        if (this._currentIndex + 1 < this._fileIndex.length) {
          this._currentIndex++;
          
          if (dir[1] == "unrated") {
            for (let i = this._currentIndex; i < this._fileIndex.length; i++) {
              if (this._fileIndex[i].rating === 0) {
                this._currentIndex = i;
                break;
              }
            }
          }
        }
        break;
      }
      case "prev": {
        if (this._currentIndex > 0) {
          this._currentIndex--;
        }
        break;
      }
    }
    
    let fileEntry = this._fileIndex[this._currentIndex];
    return this._db.get(fileEntry.id)
        .then((file) => {
          let data = {
            path: file.path,
            preview: file.preview,
            rating: file.rating,
            stats: this._getStats(file)
          };
          return {
            content: JSON.stringify(data),
            status: 200,
            type: "application/json"
          };
        });
  }
  
  _getStats(file) {
    let totalSize = this._fileIndex.reduce((result, fileEntry) => result + fileEntry.stats.size, 0);
    
    let cStatus = new Canvas(statsWidth, statsHeight);
    let ctxStatus = cStatus.getContext("2d");
    let byteWidth = statsWidth / totalSize;
    let x = 0;
    let current = {x: 0, width: 0};
    
    let cDist = new Canvas(100, 100);
    let ctxDist = cDist.getContext("2d");
    let dist = [0, 0, 0, 0, 0, 0, 0];
    
    for (let fileEntry of this._fileIndex) {
      let width = byteWidth * fileEntry.stats.size;
      if (fileEntry.id === file.id) {
        current = {x, width};
      } else {
        ctxStatus.fillStyle = colors[fileEntry.rating + 1];
        ctxStatus.fillRect(Math.round(x), 0, Math.ceil(width), statsHeight);
      }
      x += width;
      
      dist[fileEntry.rating + 1] += fileEntry.stats.size;
    }
    
    // ensure that slice for current file is always shown
    ctxStatus.fillStyle = "#FE5";
    ctxStatus.fillRect(Math.round(current.x), 0, Math.ceil(current.width), statsHeight);
    
    // draw pointer for current file
    x = current.x + current.width / 2;
    ctxStatus.fillStyle = "#EEE";
    ctxStatus.strokeStyle = "#888";
    ctxStatus.beginPath();
    ctxStatus.moveTo(x - statsHeight / 4, statsHeight);
    ctxStatus.lineTo(x, statsHeight / 2);
    ctxStatus.lineTo(x + statsHeight / 4, statsHeight);
    ctxStatus.fill();
    ctxStatus.stroke();
    
    // draw distribution pie chart
    let prevRad = -Math.PI / 2;
    let center = {x: cDist.width / 2, y: cDist.height / 2};
    for (let i = dist.length; i--;) {
      let rad = Math.PI * 2 * (dist[i] / totalSize);
      ctxDist.fillStyle = colors[i];
      ctxDist.beginPath();
      ctxDist.moveTo(center.x, center.y);
      ctxDist.arc(center.x, center.y, center.y, prevRad, prevRad + rad, false);
      ctxDist.lineTo(center.x, center.y);
      ctxDist.fill();
      prevRad += rad;
    }
    
    return {
      distributionImage: cDist.toDataURL("image/png"),
      hasPrev: this._currentIndex > 0,
      hasNext: this._currentIndex + 1 < this._fileIndex.length,
      statusImage: cStatus.toDataURL("image/png")
    };
  }
}

module.exports.createServer = createServer;
function createServer(db) {
  let server = new Server(db);
  return server.start()
      .then(() => {
        http.createServer((req, resp) => server.onRequest(req, resp)).listen(8080);
        console.log("Server started at 127.0.0.1:8080".green);
      });
}
