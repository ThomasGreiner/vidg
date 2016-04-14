"use strict";

const Canvas = require("canvas");
const fs = require("fs");
const http = require("http");
const open = require("open");
const path = require("path");
const qs = require("querystring");
const url = require("url");

const Cursor = require("./cursor");

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
  
  listen(port) {
    return this._db.fileIndex
        .then((fileIndex) => this._cursor = new Cursor(fileIndex))
        .then(() => {
          let server = http.createServer((req, resp) => this._onRequest(req, resp));
          server.listen(port);
          console.log(`Server started at 127.0.0.1:${port}`.green);
        });
  }
  
  _onRequest(req, resp) {
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
              resolve(this._getFile(this._cursor.current));
              break;
            case "/prev":
              resolve(this._getFile(this._cursor.previous()));
              break;
            case "/next":
              resolve(this._getFile(this._cursor.next()));
              break;
            case "/next-unrated": {
              resolve(this._getFile(this._cursor.next({rated: false})));
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
          let fileEntry = this._cursor.current;
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
              .then(() => this._getFile(this._cursor.current));
          resolve(result);
        }
      }
    });
  }
  
  _getFile(fileEntry) {
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
    let totalSize = 0;
    this._cursor.each((fileEntry) => totalSize += fileEntry.stats.size);
    
    let cStatus = new Canvas(statsWidth, statsHeight);
    let ctxStatus = cStatus.getContext("2d");
    let byteWidth = statsWidth / totalSize;
    let x = 0;
    let current = {x: 0, width: 0};
    
    let cDist = new Canvas(100, 100);
    let ctxDist = cDist.getContext("2d");
    let dist = [0, 0, 0, 0, 0, 0, 0];
    
    this._cursor.each((fileEntry) => {
      let width = byteWidth * fileEntry.stats.size;
      if (fileEntry.id === file.id) {
        current = {x, width};
      } else {
        ctxStatus.fillStyle = colors[fileEntry.rating + 1];
        ctxStatus.fillRect(Math.round(x), 0, Math.ceil(width), statsHeight);
      }
      x += width;
      
      dist[fileEntry.rating + 1] += fileEntry.stats.size;
    });
    
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
      hasPrev: this._cursor.hasPrevious(),
      hasNext: this._cursor.hasNext(),
      statusImage: cStatus.toDataURL("image/png")
    };
  }
}

module.exports.createServer = createServer;
function createServer(db) {
  let server = new Server(db);
  server.listen(8080);
}
