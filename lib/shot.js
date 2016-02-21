"use strict";

const Canvas = require("canvas");
const spawn = require("child_process").spawn;

const Image = Canvas.Image;
let config = {
  count: 15,
  height: 150,
  padding: 0,
  rowSize: 5,
  width: 200
};
config.rows = config.count / config.rowSize;

const reDuration = /\bDuration: (\d\d):(\d\d):(\d\d\.\d\d)\b/;

class ShotMaker {
  constructor(filename) {
    this._filename = filename;
  }
  
  // TODO: return Promise
  create(callback) {
    this._getPositions()
        .then((positions) => this._getNextFrame(positions, []))
        .then((frames) => this._onFrames(frames, callback))
        .catch((err) => console.error(err));
  }
  
  _getMetaData() {
    return new Promise((resolve, reject) => {
      let meta = {duration: null};
      let ffprobe = spawn("ffprobe", [this._filename]);
      ffprobe.stderr.on("data", (data) => {
        let str = new Buffer(data).toString();
        let duration = reDuration.exec(str);
        if (duration) {
          let hours = parseInt(duration[1], 10);
          let minutes = parseInt(duration[2], 10);
          let seconds = parseFloat(duration[3]);
          meta.duration = hours * 360 + minutes * 60 + seconds;
        }
      });
      ffprobe.on("close", () => resolve(meta));
    });
  }
  
  _getPositions() {
    return this._getMetaData()
        .then((meta) => {
          const duration = meta.duration || 30 * config.count;
          const interval = 1 / (1 + config.count);
          let positions = [];
          for (let i = 0; i < config.count; i++) {
            positions.push(duration * interval * (i + 1));
          }
          return positions;
        });
  }
  
  _getNextFrame(positions, frames) {
    return new Promise((resolve, reject) => {
      if (positions.length === 0) {
        resolve(frames);
        return;
      }
      
      // TODO: check which format it outputs (jpeg might be preferrable over png)
      let position = positions.shift();
      let ffmpeg = spawn("ffmpeg", [
        // restrict to single process
        "-threads", "1",
        // seek to position
        "-ss", position.toString(),
        // specify input file
        "-i", this._filename,
        // affirm questions
        "-y",
        // transform output image
        "-filter_complex", `scale=w=${config.width}:h=${config.height}`,
        // output via stdout
        "-f", "image2pipe",
        // number of frames to output
        "-vframes", "1",
        // no output file
        "-"
      ]);
      let buffers = [];
      ffmpeg.stdout.on("data", (data) => buffers.push(data));
      ffmpeg.on("close", () => {
        frames.push(Buffer.concat(buffers));
        resolve(this._getNextFrame(positions, frames));
      });
    });
  }
  
  _onFrames(frames, callback) {
    const width = config.rowSize * config.width + (config.rowSize - 1) * config.padding;
    const height = config.rows * config.height + (config.rows - 1) * config.padding;
    let canvas = new Canvas(width, height);
    let ctx = canvas.getContext("2d");
    ctx.fillStyle = "black";
    ctx.fillRect(0, 0, width, height);
    
    frames.forEach((frame, idx) => {
      if (frame.length === 0)
        return;
      
      let image = new Image();
      image.src = frame;
      const x = (idx % config.rowSize) * (config.width + config.padding);
      const y = (idx / config.rowSize >> 0) * (config.height + config.padding);
      ctx.drawImage(image, x, y, config.width, config.height);
    });
    canvas.toDataURL("image/jpeg", callback);
  }
}
module.exports.ShotMaker = ShotMaker;
