"use strict";

const path = require("path");

const fs = new Map();
const stats = new Map();

function lstat(filepath, callback) {
  callback(null, stats.get(filepath));
}

function readdir(filepath, callback) {
  callback(null, fs.get(filepath));
}

module.exports = (config) => {
  for (let dirPath in config) {
    for (let file of config[dirPath]) {
      stats.set(path.join(dirPath, file.path), {
        birthtime: Date.now(),
        ino: file.id,
        size: 12,
        isDirectory: () => false,
        isSymbolicLink: () => false
      });
    }
    
    let filenames = config[dirPath].map(({path}) => path);
    fs.set(dirPath, filenames);
  }
  
  return {lstat, readdir};
};
