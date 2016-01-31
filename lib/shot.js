"use strict";

const Canvas = require("canvas");
const ffmpeg = require("fluent-ffmpeg");
const fs = require("fs");
const path = require("path");

const Image = Canvas.Image;
const tmpDir = "/tmp/shot";
let id = 0;
let config = {
  count: 15,
  height: 150,
  padding: 10,
  rowSize: 5,
  width: 200
};
config.rows = config.count / config.rowSize;

class ShotMaker {
  constructor(filename) {
    this._filename = filename;
    this._shots = [];
  }
  
  create(callback) {
    ffmpeg(this._filename)
      .inputOptions("-threads 1")
      .on("filenames", (filenames) => this._shots = filenames)
      .on("end", this._onScreenshotsDone.bind(this, callback))
      .on("error", callback)
      .screenshots({
        count: config.count,
        filename: `s${++id}`,
        folder: tmpDir,
        size: `${config.width}x${config.height}`
      });
  }
  
  _onScreenshotsDone(callback) {
    const width = config.rowSize * config.width + (config.rowSize - 1) * config.padding;
    const height = config.rows * config.height + (config.rows - 1) * config.padding;
    let canvas = new Canvas(width, height);
    let ctx = canvas.getContext("2d");
    ctx.fillRect(0, 0, width, height);
    
    let count = this._shots.length;
    let lastError = null;
    this._shots.forEach((file, idx) => {
      file = path.join(tmpDir, file);
      fs.readFile(file, (err, content) => {
        if (err) {
          lastError = err;
        } else {
          let image = new Image();
          image.src = content;
          
          const x = (idx % config.rowSize) * (config.width + config.padding);
          const y = (idx / config.rowSize >> 0) * (config.height + config.padding);
          ctx.drawImage(image, x, y, config.width, config.height);
          
          fs.unlink(file);
        }
        
        if (!--count) {
          if (lastError) {
            callback(lastError);
          } else {
            canvas.toDataURL("image/jpeg", callback);
          }
        }
      });
    });
  }
}
module.exports.ShotMaker = ShotMaker;
