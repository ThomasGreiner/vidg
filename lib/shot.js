"use strict";

const {Canvas, Image} = require("canvas");
const spawn = require("child_process").spawn;

let config = {
  count: 15,
  height: 150,
  padding: 0,
  rowSize: 5,
  width: 200
};
config.rows = config.count / config.rowSize;

const reGeneral = /\bDuration: (\d+):(\d+):(\d+\.\d+), start: [^,]+, bitrate: (\d+) kb\/s\b/;
const reVideo = /\bStream #.+: Video: .+, (\d+)x(\d+).+, (\d+(?:\.\d+)?) fps,/;

function toHex(num) {
  var hex = num.toString(16);
  return (hex.length > 1) ? hex : `0${hex}`;
}

class ShotMaker {
  // TODO: reduce overhead by making this function part of _onFrames()
  static getColors(dataUri) {
    let image = new Image();
    image.src = dataUri;
    
    let canvas = new Canvas(200, 150);
    let ctx = canvas.getContext("2d");
    ctx.drawImage(image, 0, 0, 200, 150);
    
    const binSize = 16;
    const colorCount = 5;
    let bins = new Map();
    let iData = ctx.getImageData(0, 0, 200, 150).data;
    for (let i = 0; i < iData.length; i += 4) {
      let [r, g, b] = iData.slice(i, i + 3);
      
      r = (r / binSize >> 0) * binSize;
      g = (g / binSize >> 0) * binSize;
      b = (b / binSize >> 0) * binSize;
      let id = `${toHex(r)}${toHex(g)}${toHex(b)}`;
      let count = bins.get(id) || 0;
      bins.set(id, count + 1);
    }
    
    // Remove black to ignore black bars at edge of video
    bins.delete("000000");
    
    let colors = Array.from(bins)
      .sort((a, b) => b[1] - a[1])
      .map(([color, count]) => color)
      .slice(0, colorCount);
    return colors.join("");
  }
  
  constructor(filename) {
    this._filename = filename;
  }
  
  create() {
    return this._getPositions()
        .then((positions) => this._getNextFrame(positions, []))
        .then((frames) => this._onFrames(frames))
        .catch((err) => console.error(err));
  }
  
  getMetaData() {
    return new Promise((resolve, reject) => {
      let content = "";
      let ffprobe = spawn("ffprobe", [this._filename]);
      ffprobe.stderr.on("data", (data) => content += new Buffer(data).toString());
      ffprobe.on("close", () => {
        let meta = {
          bitrate: null,
          duration: null,
          fps: null,
          height: null,
          width: null
        };
        
        let general = reGeneral.exec(content);
        let video = reVideo.exec(content);
        if (!general || !video) {
          reject("Invalid ffprobe output format", this._filename);
          return;
        }
        
        let hours = parseInt(general[1], 10);
        let minutes = parseInt(general[2], 10);
        let seconds = parseFloat(general[3]);
        meta.duration = hours * 360 + minutes * 60 + seconds;
        meta.bitrate = parseInt(general[4], 10);
      
        meta.width = parseInt(video[1], 10);
        meta.height = parseInt(video[2], 10);
        meta.fps = parseInt(video[3], 10);
        
        resolve(meta);
      });
    });
  }
  
  _getPositions() {
    return this.getMetaData()
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
      // listenting for data on stderr to avoid hangs due to full pipe buffer
      ffmpeg.stderr.on("data", (data) => {});
      ffmpeg.stdout.on("data", (data) => buffers.push(data));
      ffmpeg.on("close", () => {
        frames.push(Buffer.concat(buffers));
        resolve(this._getNextFrame(positions, frames));
      });
    });
  }
  
  _onFrames(frames) {
    return new Promise((resolve, reject) => {
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
      canvas.toDataURL("image/jpeg", (err, dataUri) => (err) ? reject(err) : resolve(dataUri));
    });
  }
}
module.exports.ShotMaker = ShotMaker;
