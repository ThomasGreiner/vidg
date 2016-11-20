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
    return Promise.all([
      this._db.fileIndex,
      this._db.comparisons
    ]).then(([fileIndex, comparisons]) => {
      this._index = new Cursor(fileIndex);
      this._comparisons = new Cursor(comparisons);
      this._optimizations = new Cursor([]);
      
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
        
        switch (urlpath) {
          case "/":
            return getStaticFile("static/videos.htm");
          case "/current":
            return this._getFile(this._index.current);
          case "/next":
            return this._getFile(this._index.next());
          case "/next-unrated":
            return this._getFile(this._index.next({rated: false}));
          case "/prev":
            return this._getFile(this._index.previous());
          case "/prev-unrated":
            return this._getFile(this._index.previous({rated: false}));
          case "/filter-rating":
            if (params.value == "any") {
              this._index.filter(null);
            } else {
              this._index.filter((entry) => entry.rating == params.value);
            }
            return this._getFile(this._index.current);
          case "/filter-samesize":
            if (params.value == "any") {
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
            }
            return this._getFile(this._index.current);
          
          case "/compare":
            return getStaticFile("static/compare.htm");
          case "/compare/current":
            return this._getComparison(this._comparisons.current);
          case "/compare/next":
            return this._getComparison(this._comparisons.next());
          case "/compare/prev":
            return this._getComparison(this._comparisons.previous());
          
          case "/optimize":
            return getStaticFile("static/optimize.htm");
          case "/optimize/current":
            return this._getOptimization(this._optimizations.current);
          case "/optimize/next":
            return this._getOptimization(this._optimizations.next());
          case "/optimize/prev":
            return this._getOptimization(this._optimizations.previous());
          
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
  
  _getComparison(comparison) {
    let a = this._db.get(comparison.a.id);
    let b = this._db.get(comparison.b.id);
    return Promise.all([a, b])
        .then((files) => {
          let ids = new Set(files.map((file) => file.id));
          let data = {
            a: files[0],
            b: files[1],
            factors: comparison.factors,
            stats: getStats(this._comparisons, ids)
          };
          return {
            content: JSON.stringify(data),
            status: 200,
            type: "application/json"
          };
        });
  }
  
  _getFile(fileEntry) {
    if (!fileEntry)
      return {status: 404};
    
    return this._db.get(fileEntry.id)
        .then((file) => {
          let data = {
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
  
  _getOptimization(fileEntry) {
    return {
      content: "[]",
      status: 200,
      type: "application/json"
    };
  }
}
module.exports = Server;
