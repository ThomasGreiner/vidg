const fs = require("fs");
const http = require("http");
const path = require("path");
const qs = require("querystring");
const url = require("url");

import * as api from "../storage/api.js";

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
    const ext = path.parse(filepath).ext.substr(1);
    const stats = await fs.promises.stat(filepath);
    let [start, end] = range.replace(/bytes=/, "").split("-");
    start = parseInt(start, 10);
    const total = stats.size;
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
    case 206: {
      const [start, end, total] = data.range;
      resp.writeHead(data.status, {
        "Accept-Ranges": "bytes",
        "Content-Length": (end - start) + 1,
        "Content-Range": `bytes ${start}-${end}/${total}`,
        "Content-Type": data.type
      });
      
      const stream = fs.createReadStream(data.content, {start, end});
      stream.on("open", () => {
        stream.pipe(resp);
      });
      stream.on("error", (err) => {
        resp.end(err);
      });
      break;
    }
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

async function handleRequest(req) {
  if (req.method !== "GET")
    return {status: 400};
  
  const urlpath = url.parse(req.url).pathname;
  if (urlpath !== "/file")
    return {status: 404};
  
  const urlInfo = url.parse(req.url);
  const params = qs.parse(urlInfo.query);
  if (params.type !== "video")
    return {status: 400};
  
  const file = await api.files.get(params.id);
  return getVideo(file.path.absolute, req.headers.range);
}

async function onRequest(req, resp) {
  try {
    const data = await handleRequest(req);
    respond(resp, data);
  } catch (ex) {
    console.error(ex);
    resp.writeHead(500);
    resp.end();
  }
}

export function listen(port) {
  const server = http.createServer(onRequest);
  server.listen(port);
  console.log(`Server started at 127.0.0.1:${port}`);
}
