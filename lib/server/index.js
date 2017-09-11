"use strict";

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
    return this._db.fileIndex.then((fileIndex) => {
      this._index = new Cursor(fileIndex);
      
      this._server = http.createServer((req, resp) => this._onRequest(req, resp));
      this._server.listen(port);
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
    let urlpath = url.parse(req.url).pathname;
    switch (req.method) {
      case "GET": {
        if (/^\/static\//.test(urlpath))
          return getStaticFile(path.relative("/", urlpath));
        
        // TODO: breaks /playlist/top-rated.m3u8
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
                let query = (params.value) ? this._db.search(params.value) : this._db.fileIndex;
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
          case "/playlist/top-rated.m3u8":
            return this._db.topRated.then((filepaths) => {
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
                        this._index.filter((entry) => entry.rating != -1, true);
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
  
  _getFile(fileEntry) {
    if (!fileEntry)
      return {status: 404};
    
    return this._db.get(fileEntry.id)
        .then((file) => {
          let data = {
            bitrate: file.stats.bitrate,
            created: file.stats.created,
            duration: file.stats.duration,
            path: this._db.toRelativePath(file.path),
            preview: file.preview,
            rating: file.rating,
            size: file.stats.size,
            stats: getStats(this._index, new Set([file.id]))
          };
          return {
            content: JSON.stringify(data),
            status: 200,
            type: "application/json"
          };
        });
  }
}
module.exports = Server;
