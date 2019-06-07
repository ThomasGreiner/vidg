"use strict";

const fs = require("fs");
const http = require("http");
const open = require("open");
const path = require("path");
const url = require("url");
const {promisify} = require("util");

const Cursor = require("../cursor");
const {
  getParams,
  getStaticFile,
  getStatusCharts,
  getStatusData
} = require("./utils");

const stat = promisify(fs.stat);

// TODO: add support for video/webm
const videoTypes = {
  avi: "video/x-msvideo",
  m4v: "video/mp4",
  mkv: "video/x-matroska",
  mov: "video/quicktime",
  mp4: "video/mp4",
  mpeg: "video/mpeg",
  mpg: "video/mpeg",
  ogv: "video/ogg",
  wmv: "video/x-ms-wmv"
};

class Server {
  constructor(db) {
    this._db = db;
  }
  
  async listen(port) {
    await this._load()
    this._server = http.createServer((req, resp) => this._onRequest(req, resp));
    this._server.listen(port);
    console.log(`Server started at 127.0.0.1:${port}`.green);
  }
  
  async _onRequest(req, resp) {
    try {
      let params = await getParams(req);
      let data = await this._handleRequest(req, params);
      return this._respond(resp, data);
    } catch (ex) {
      if (ex instanceof Error) {
        console.error(ex.stack);
        ex = null;
      }
      resp.writeHead(ex || 500);
      resp.end();
    }
  }
  
  async _handleRequest(req, params) {
    let urlpath = url.parse(req.url).pathname;
    
    switch (req.method) {
      case "GET":
        // Static files
        if (urlpath === "/") {
          urlpath = "/static/videos.htm";
        }
        if (/^\/static\//.test(urlpath))
          return getStaticFile(path.relative("/", urlpath));
        
        switch (urlpath) {
          case "/file":
            let fileEntry = this._index.current;
            if (params.dir) {
              let unrated = (params.unrated === "true");
              
              if (params.dir === "next") {
                fileEntry = this._index.next({rated: !unrated});
              } else if (params.dir === "prev") {
                fileEntry = this._index.previous({rated: !unrated});
              }
            }
            
            if (!fileEntry)
              return {status: 404};
            
            if (params.type === "video") {
              let {range} = req.headers;
              if (!range) {
                // 416 Wrong range
                return {status: 416};
              }

              return this._getVideo(fileEntry.id, range);
            }
            
            return this._getFile(fileEntry);
        }
    }
    
    switch (req.method) {
      case "GET": {
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
                let fileIndex = await query;
                this._index = new Cursor(fileIndex);
                return this._getFile(this._index.current);
            }
            return this._getFile(this._index.current);

          case "/playlist/all.m3u8": {
            let promisedFilepaths = [];
            this._index.each((entry) => {
              let promisedFilepath = this._db.get(entry.id).then(({path}) => path);
              promisedFilepaths.push(promisedFilepath);
            });
            
            if (promisedFilepaths.length === 0) {
              console.error("No files in playlist");
              return {status: 404};
            }
            
            let filepaths = await Promise.all(promisedFilepaths);
            return {
              content: `file://${filepaths.join("\nfile://")}`,
              status: 200,
              type: "audio/mpegurl"
            };
          }
          case "/playlist/videos.m3u8": {
            let filepaths = await this._db.getPlaylist();
            if (filepaths.length === 0) {
              console.error("No files in playlist");
              return {status: 404};
            }
            return {
              content: `file://${filepaths.join("\nfile://")}`,
              status: 200,
              type: "audio/mpegurl"
            };
          }
          
          case "/sort":
            let [key, value] = params.value.split("-", 2);
            let ascending = value == "asc";
            switch (key) {
              case "random":
                this._index.sort(() => Math.random() - 0.5);
                break;
              default:
                this._index.sort((a, b) => {
                  let valueA = (key in a) ? a[key] : a.stats[key];
                  let valueB = (key in b) ? b[key] : b.stats[key];
                  
                  if (ascending)
                    return valueA - valueB;
                  return valueB - valueA;
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
        let file = await this._db.get(fileEntry.id);
        let rating = file.rating;
        
        switch (urlpath) {
          case "/empty-trash":
            await this._db.emptyTrash();
            await this._load();
            return this._getFile(this._index.current);
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
        
        await this._db.setRating(file.id, rating);
        fileEntry.rating = rating;
        
        return this._getFile(this._index.current);
      }
    }
    
    return {status: 404};
  }
  
  async _load() {
    let fileIndex = await this._db.getFileIndex();
    this._index = new Cursor(fileIndex);
    this._ranges = await this._db.getRanges();
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
  
  async _getFile(fileEntry) {
    if (!fileEntry)
      return {status: 404};
    
    let file = await this._db.get(fileEntry.id);
    file.path = this._db.toRelativePath(file.path);
    let ranges = this._ranges;
    let {ratings, totalSize} = getStatusData(this._index);
    let charts = getStatusCharts(
      this._index,
      new Set([file.id]),
      totalSize
    );
    
    return {
      content: JSON.stringify({
        charts, file, ranges, ratings,
        status: {
          hasPrev: this._index.hasPrevious(),
          hasNext: this._index.hasNext()
        }
      }),
      status: 200,
      type: "application/json"
    };
  }
  
  async _getVideo(fileId, range) {
    try {
      let file = await this._db.get(fileId);
      let ext = path.parse(file.path).ext.substr(1);
      let stats = await stat(file.path);
      let [start, end] = range.replace(/bytes=/, "").split("-");
      start = parseInt(start, 10);
      let total = stats.size;
      end = (end) ? parseInt(end, 10) : total - 1;
      
      return {
        content: file.path,
        range: [start, end, total],
        status: 206,
        type: videoTypes[ext] || "video/mp4"
      };
    } catch (ex) {
      return {status: 404};
    }
  }
}
module.exports = Server;
