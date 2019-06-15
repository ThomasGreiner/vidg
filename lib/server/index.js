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

async function getVideo(filepath, range) {
  if (!range) {
    // 416 Wrong range
    return {status: 416};
  }
  
  try {
    let ext = path.parse(filepath).ext.substr(1);
    let stats = await stat(filepath);
    let [start, end] = range.replace(/bytes=/, "").split("-");
    start = parseInt(start, 10);
    let total = stats.size;
    end = (end) ? parseInt(end, 10) : total - 1;
    
    return {
      content: filepath,
      range: [start, end, total],
      status: 206,
      type: videoTypes[ext] || "video/mp4"
    };
  } catch (ex) {
    return {status: 404};
  }
}

function respond(resp, data) {
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
      respond(resp, data);
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
      case "DELETE":
        switch (urlpath) {
          case "/list":
            if (!("rating" in params))
              return {status: 400};
            
            let rating = parseInt(params.rating, 10);
            if (rating !== -1)
              return {status: 400};
            
            await this._db.emptyTrash();
            await this._load();
            return {status: 204};
        }
        break;
      case "GET":
        // Static files
        if (urlpath === "/") {
          urlpath = "/static/index.htm";
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
            
            if (params.type === "video") {
              let file = await this._db.get(fileEntry.id);
              return getVideo(file.path, req.headers.range);
            }
            
            return this._getFile(fileEntry);
          case "/playlist":
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
        break;
      case "PATCH":
        switch (urlpath) {
          case "/file/rating":
            let fileEntry = this._index.current;
            let file = await this._db.get(fileEntry.id);
            let rating = file.rating;
            
            switch (params.dir) {
              case "down":
                if (rating > -1) {
                  rating--;
                }
                break;
              case "up":
                if (rating < 5) {
                  rating++;
                }
                break;
              default:
                return {status: 400};
            }
            
            await this._db.setRating(file.id, rating);
            fileEntry.rating = rating;
            return {status: 204};
        }
        break;
      case "POST":
        switch (urlpath) {
          case "/file/open":
            let fileEntry = this._index.current;
            let file = await this._db.get(fileEntry.id);
            open(file.path, "vlc");
            return {status: 204};
        }
        break;
      case "PUT":
        switch (urlpath) {
          case "/list":
            this._index.filter(null);
            if (params.filter) {
              let [key] = Object.keys(params.filter);
              let value = params.filter[key];
              
              switch (key) {
                case "rating":
                  this._index.filter((entry) => entry.rating === value);
                  break;
                case "sameduration":
                  if (!value)
                    break;
                  
                  let durations = new Set();
                  let sameDurations = new Set();
                  this._index.each((entry) => {
                    let {duration} = entry.stats;
                    if (durations.has(duration)) {
                      sameDurations.add(duration);
                    } else {
                      durations.add(duration);
                    }
                  });
                  this._index.filter((entry) => sameDurations.has(entry.stats.duration));
                  break;
                case "samesize":
                  if (!value)
                    break;
                  
                  let sizes = new Set();
                  let sameSizes = new Set();
                  this._index.each((entry) => {
                    let {size} = entry.stats;
                    if (sizes.has(size)) {
                      sameSizes.add(size);
                    } else {
                      sizes.add(size);
                    }
                  });
                  this._index.filter((entry) => sameSizes.has(entry.stats.size));
                  break;
                case "text":
                  if (!value)
                    break;
                  
                  let fileIndex = await this._db.search(value);
                  let foundIds = new Set(fileIndex.map((entry) => entry.id));
                  this._index.filter((entry) => foundIds.has(entry.id));
                  break;
              }
            }
            
            if (params.sort) {
              let {key, dir} = params.sort;
              if (key === "random") {
                this._index.sort(() => Math.random() - 0.5);
              } else {
                this._index.sort((a, b) => {
                  let valueA = (key in a) ? a[key] : a.stats[key];
                  let valueB = (key in b) ? b[key] : b.stats[key];
                  
                  if (dir === "asc")
                    return valueA - valueB;
                  return valueB - valueA;
                });
              }
            } else {
              // TODO: reset order
            }
            
            return {status: 204};
        }
        break;
    }
    
    return {status: 404};
  }
  
  async _load() {
    let fileIndex = await this._db.getFileIndex();
    this._index = new Cursor(fileIndex);
    this._ranges = await this._db.getRanges();
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
}
module.exports = Server;
