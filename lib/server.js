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
const colors = ["#FAA", "#FFF", "#EFE", "#DFD", "#CFC", "#BFB", "#AFA"];
const statsWidth = 1000;
const statsHeight = 20;

class Server {
  constructor(inputDir, sync) {
    this._inputDir = inputDir;
    this._sync = sync;
    this._currentIndex = 0;
  }
  
  onRequest(req, resp) {
    this._getParams(req)
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
  
  _getParams(req) {
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
              let result = this._sync.emptyTrash()
                  .then(() => this._getFile("current"));
              resolve(result);
              break;
            }
            case "/current":
            case "/prev":
            case "/next": {
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
          let file = this._sync.files[this._currentIndex];
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
              open(file.path);
              resolve({status: 204});
              return;
            }
          }
          
          let result = this._sync.update(file, "rating", rating)
              .then(() => this._getFile("current"));
          resolve(result);
          break;
        }
      }
    });
  }
  
  _getFile(dir) {
    return new Promise((resolve, reject) => {
      let files = this._sync.files;
      if (!files) {
        reject(404);
        return;
      }
      
      if (dir == "next") {
        if (this._currentIndex + 1 < files.length) {
          this._currentIndex++;
        }
      } else if (dir == "prev") {
        if (this._currentIndex > 0) {
          this._currentIndex--;
        }
      } else if (this._currentIndex >= files.length) {
        this._currentIndex = files.length - 1;
      }
      
      let file = files[this._currentIndex];
      if (!file) {
        reject(404);
        return;
      }
      
      let data = {
        image: file.screenshot,
        path: file.path,
        rating: file.rating,
        stats: this._getStats(file)
      };
      resolve({
        content: JSON.stringify(data),
        status: 200,
        type: "application/json"
      });
    });
  }
  
  _getStats(file) {
    let files = this._sync.files;
    let canvas = new Canvas(statsWidth, statsHeight);
    let ctx = canvas.getContext("2d");
    let totalSize = files.reduce((result, file) => result + file.stats.size, 0);
    let byteWidth = statsWidth / totalSize;
    let currentX = 0;
    for (let f of files) {
      let width = byteWidth * f.stats.size;
      ctx.fillStyle = (f === file) ? "#FE5" : colors[f.rating + 1];
      ctx.fillRect(currentX, 0, width, statsHeight);
      currentX += width;
    }
    
    return {
      hasPrev: this._currentIndex > 0,
      hasNext: this._currentIndex + 1 < files.length,
      statusImage: canvas.toDataURL("image/png")
    };
  }
}

module.exports.createServer = createServer;
function createServer(inputDir, sync) {
  let server = new Server(inputDir, sync);
  http.createServer((req, resp) => server.onRequest(req, resp)).listen(8080);
  console.log("Server started at 127.0.0.1:8080".green);
  open("http://127.0.0.1:8080");
}
