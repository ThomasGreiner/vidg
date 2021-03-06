"use strict";

function getPreview(path) {
  return `data:${path}`;
}
exports.getPreview = getPreview;

class ShotMaker {
  static getColors() {
    return "000000000000000000000000000000";
  }
  
  constructor(path) {
    this._path = path;
  }
  
  create() {
    return getPreview(this._path);
  }
  
  getMetaData() {
    return {
      bitrate: 0,
      duration: 0,
      fps: 0,
      height: 0,
      width: 0
    };
  }
}
exports.ShotMaker = ShotMaker;
