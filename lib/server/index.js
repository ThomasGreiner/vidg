"use strict";

const fs = require("fs");
const http = require("http");
const open = require("open");
const path = require("path");
const url = require("url");

const Cursor = require("../cursor");
const {getParams, getStaticFile, getStats} = require("./utils");

class Server {
  constructor(db) {
    this._db = db;
  }
  
  listen(port) {
    return Promise.all([
      this._db.getFileIndex(),
      this._db.getRanges()
    ]).then(([fileIndex, ranges]) => {
      this._index = new Cursor(fileIndex);
      this._ranges = ranges;
      
      this._server = http.createServer((req, resp) => this._onRequest(req, resp));
      this._server.listen(port);
      console.log(`Server started at 127.0.0.1:${port}`.green);
    });
  }
  
  _onRequest(req, resp) {
    getParams(req)
        .then((params) => this._handleRequest(req, params))
        .then((data) => this._respond(resp, data))
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
    let urlpath = url.parse(req.url).pathname;
    switch (req.method) {
      case "GET": {
        if (/^\/static\//.test(urlpath))
          return getStaticFile(path.relative("/", urlpath));
        
        let action = urlpath;
        let variant = null;
        if (/^\/[^\/]+\-/.test(urlpath)) {
          [action, variant] = urlpath.split("-", 2);
        }
        
        switch (action) {
          case "/":
            return getStaticFile("static/videos.htm");
          case "/current":
            return this._getFile(this._index.current);
          case "/next":
            if (variant == "unrated")
              return this._getFile(this._index.next({rated: false}));
            return this._getFile(this._index.next());
          case "/prev":
            if (variant == "unrated")
              return this._getFile(this._index.previous({rated: false}));
            return this._getFile(this._index.previous());
          
          case "/filter":
            switch (variant) {
              case "rating":
                if (params.value == "any") {
                  this._index.filter(null);
                } else {
                  this._index.filter((entry) => entry.rating == params.value);
                }
                break;
              case "sameduration":
                if (params.value == "false") {
                  this._index.filter(null);
                } else {
                  let durations = new Set();
                  let sameDurations = new Set();
                  this._index.each((entry) => {
                    if (durations.has(entry.stats.duration)) {
                      sameDurations.add(entry.stats.duration);
                    } else {
                      durations.add(entry.stats.duration);
                    }
                  });
                  this._index.filter((entry) => sameDurations.has(entry.stats.duration));
                  this._index.sort((a, b) => b.stats.duration - a.stats.duration);
                }
                break;
              case "samesize":
                if (params.value == "false") {
                  this._index.filter(null);
                } else {
                  let sizes = new Set();
                  let sameSizes = new Set();
                  this._index.each((entry) => {
                    if (sizes.has(entry.stats.size)) {
                      sameSizes.add(entry.stats.size);
                    } else {
                      sizes.add(entry.stats.size);
                    }
                  });
                  this._index.filter((entry) => sameSizes.has(entry.stats.size));
                  this._index.sort((a, b) => b.stats.size - a.stats.size);
                }
                break;
              case "search":
                let query = (params.value) ? this._db.search(params.value) : this._db.getFileIndex();
                return query.then((fileIndex) => {
                  this._index = new Cursor(fileIndex);
                  return this._getFile(this._index.current);
                });
            }
            return this._getFile(this._index.current);

          case "/playlist/all.m3u8":
            let filepaths = [];
            this._index.each((entry) => {
              let filepath = this._db.get(entry.id).then(({path}) => path);
              filepaths.push(filepath);
            });
            
            if (filepaths.length === 0) {
              console.error("No files in playlist");
              return {status: 404};
            }
            
            return Promise.all(filepaths).then((filepaths) => {
              return {
                content: filepaths.join("\n"),
                status: 200,
                type: "audio/mpegurl"
              };
            });
          case "/playlist/videos.m3u8":
            return this._db.getPlaylist().then((filepaths) => {
              if (filepaths.length === 0) {
                console.error("No files in playlist");
                return {status: 404};
              }
              return {
                content: filepaths.join("\n"),
                status: 200,
                type: "audio/mpegurl"
              };
            });
          
          case "/sort":
            let [key, value] = params.value.split("-", 2);
            let ascending = value == "asc";
            switch (key) {
              case "random":
                this._index.sort(() => Math.random() - 0.5);
                break;
              default:
                this._index.sort((a, b) => {
                  if (ascending)
                    return a.stats[key] - b.stats[key];
                  return b.stats[key] - a.stats[key];
                });
                break;
            }
            return this._getFile(this._index.current);
          
          case "/video":
            let {range} = req.headers;
            if (!range) {
              // 416 Wrong range
              return {status: 416};
            }

            return this._getVideo(params.id, range);
        }
        break;
      }
      case "POST": {
        let fileEntry = this._index.current;
        return this._db.get(fileEntry.id)
            .then((file) => {
              let rating = file.rating;
              switch (urlpath) {
                case "/empty-trash":
                  return this._db.emptyTrash()
                      .then(() => {
                        return Promise.all([
                          this._db.getFileIndex(),
                          this._db.getRanges()
                        ]);
                      })
                      .then(([fileIndex, ranges]) => {
                        this._index = new Cursor(fileIndex);
                        this._ranges = ranges;
                        return this._getFile(this._index.current);
                      });
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
                  open(file.path, "vlc");
                  return {status: 204};
                case "/view-all":
                  open("http://localhost:8080/playlist/all.m3u8", "vlc");
                  return {status: 204};
              }
              
              return this._db.setRating(file.id, rating)
                  .then(() => fileEntry.rating = rating);
            })
            .then(() => this._getFile(this._index.current));
      }
    }
    
    return Promise.reject(404);
  }
  
  _respond(resp, data) {
    switch (data.status) {
      case 206:
        let [start, end, total] = data.range;
        resp.writeHead(data.status, {
          "Accept-Ranges": "bytes",
          "Content-Length": (end - start) + 1,
          "Content-Range": `bytes ${start}-${end}/${total}`,
          "Content-Type": data.type
        });
        
        let stream = fs.createReadStream(data.content, {start, end});
        stream.on("open", () => {
          stream.pipe(resp);
        });
        stream.on("error", (err) => {
          resp.end(err);
        });
        break;
      default:
        resp.writeHead(data.status, {
          "Content-Type": data.type || "text/plain"
        });
        if ("content" in data) {
          resp.write(data.content);
        }
        resp.end();
    }
  }
  
  _getFile(fileEntry) {
    if (!fileEntry)
      return {status: 404};
    
    return this._db.get(fileEntry.id)
        .then((file) => {
          file.path = this._db.toRelativePath(file.path);
          let ranges = this._ranges;
          let stats = getStats(this._index, new Set([file.id]));
          
          return {
            content: JSON.stringify({file, ranges, stats}),
            status: 200,
            type: "application/json"
          };
        });
  }
  
  _getVideo(fileId, range) {
    return this._db.get(fileId)
      .then(({path}) => {
        return new Promise((resolve, reject) => {
          fs.stat(path, (err, stats) => {
            if (err) {
              resolve({status: 404});
              return;
            }
            
            let [start, end] = range.replace(/bytes=/, "").split("-");
            start = parseInt(start, 10);
            let total = stats.size;
            end = (end) ? parseInt(end, 10) : total - 1;
            
            resolve({
              content: path,
              range: [start, end, total],
              status: 206,
              type: "video/mp4"
            });
          });
        });
      });
  }
}
module.exports = Server;
