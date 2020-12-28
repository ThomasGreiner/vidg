"use strict";

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
