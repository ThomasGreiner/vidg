"use strict";

const path = require("path");

const fs = new Map();
const stats = new Map();

async function lstat(filepath) {
  return stats.get(filepath);
}

async function readdir(filepath) {
  return fs.get(filepath);
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
  
  return {promises: {lstat, readdir}};
};
