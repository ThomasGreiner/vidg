"use strict";

const {Canvas} = require("canvas");
const fs = require("fs");
const path = require("path");
const qs = require("querystring");
const url = require("url");
const {promisify} = require("util");

const readFile = promisify(fs.readFile);

const rootPath = path.dirname(require.main.filename);
const typesBinary = new Set(["woff"]);
const types = {
  css: "text/css",
  htm: "text/html",
  js: "application/javascript",
  ttf: "font/opentype",
  woff: "font/woff"
};
const colors = ["#D88", "#FFF", "#DED", "#CDC", "#ADA", "#8D8", "#6D6"];
const statsWidth = 2000;
const statsHeight = 20;

function getParams(req) {
  return new Promise((resolve, reject) => {
    switch (req.method) {
      case "DELETE":
      case "GET":
      case "PATCH": {
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
      case "PUT": {
        let params = "";
        req.on("data", (data) => params += data.toString());
        req.on("end", () => {
          params = JSON.parse(params);
          resolve(params);
        });
        break;
      }
      default: {
        reject();
      }
    }
  });
}
module.exports.getParams = getParams;

async function getStaticFile(filepath) {
  filepath = path.resolve(rootPath, filepath);
  let ext = path.extname(filepath).substr(1);
  
  try {
    let content = await readFile(filepath, typesBinary.has(ext) ? null : "utf-8");
    if (!(ext in types))
      return {status: 404};
    
    return {
      content,
      status: 200,
      type: types[ext]
    };
  } catch (ex) {
    return {status: 404};
  }
}
module.exports.getStaticFile = getStaticFile;

function getStatusData(cursor) {
  let totalSize = 0;
  let ratings = Object.create(null);
  
  cursor.each((entry) => {
    let size = (entry.a || entry).stats.size;
    let rating = (entry.a || entry).rating;
    if (!(rating in ratings)) {
      ratings[rating] = {count: 0, size: 0};
    }
    ratings[rating].count++;
    ratings[rating].size += size;
    totalSize += size;
  });
  
  return {ratings, totalSize};
}
module.exports.getStatusData = getStatusData;

function getStatusCharts(cursor, ids, totalSize) {
  let cStatus = new Canvas(statsWidth, statsHeight);
  let ctxStatus = cStatus.getContext("2d");
  let byteWidth = statsWidth / totalSize;
  let x = 0;
  let current = null;
  
  let cDist = new Canvas(100, 100);
  let ctxDist = cDist.getContext("2d");
  let dist = [0, 0, 0, 0, 0, 0, 0];
  
  cursor.each((entry) => {
    entry = entry.a || entry;
    let width = byteWidth * entry.stats.size;
    if (ids.has(entry.id)) {
      current = current || {x, width};
    }
    ctxStatus.fillStyle = colors[entry.rating + 1];
    ctxStatus.fillRect(Math.round(x), 0, Math.ceil(width), statsHeight);
    x += width;
    
    dist[entry.rating + 1] += entry.stats.size;
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
    distribution: cDist.toDataURL("image/png"),
    status: cStatus.toDataURL("image/png")
  };
}
module.exports.getStatusCharts = getStatusCharts;
