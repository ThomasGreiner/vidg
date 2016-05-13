"use strict";

const fs = require("fs");
const path = require("path");
const trash = require("trash");

const utils = require("./utils");
const ShotMaker = require("./shot").ShotMaker;

const videoExtensions = new Set([
  "3gp",
  "asf",
  "avi",
  "divx",
  "m4v",
  "mkv",
  "mov",
  "mp2t",
  "mp4",
  "mpeg",
  "mpg",
  "ogv",
  "quicktime",
  "wmv"
]);

function readDirectory(dir) {
  return new Promise((resolve, reject) => {
    fs.readdir(dir, (err, filenames) => {
      if (err) {
        reject(err);
        return;
      }
      
      let nestedFiles = filenames.map((filename) => {
        return new Promise((resolve, reject) => {
          let filepath = path.join(dir, filename);
          fs.lstat(filepath, (err, stat) => {
            if (err) {
              reject(err);
            } else if (stat.isSymbolicLink()) {
              console.warn("  Ignoring symbolic link", filepath);
              resolve([]);
            } else if (stat.isDirectory()) {
              resolve(readDirectory(filepath));
            } else {
              resolve([{
                id: stat.ino,
                path: filepath,
                stats: {
                  bitrate: null,
                  created: +stat.birthtime,
                  duration: null,
                  fps: null,
                  height: null,
                  size: stat.size,
                  width: null
                }
              }]);
            }
          });
        });
      });
      
      let files = Promise.all(nestedFiles)
          .then((nestedFiles) => {
            return nestedFiles.reduce((files, subdirFiles) =>
                files.concat(subdirFiles), []);
          });
      resolve(files);
    });
  });
}

function filterInvalidFilenames(files) {
  return files.filter((file) => {
    let ext = path.extname(file.path).substr(1).toLowerCase();
    return videoExtensions.has(ext);
  });
}

class MetaDataSync {
  constructor(db) {
    this._db = db;
  }
  
  sync(opts) {
    console.info("Syncing files");
    return readDirectory(opts.inputDir)
        .then(filterInvalidFilenames)
        .then((foundFiles) => {
          console.log(`  Found files: ${foundFiles.length}`);
          return this._db.allFiles
              .then((knownFiles) => utils.diff("id", knownFiles, foundFiles, ["path"]));
        })
        .then((changes) => {
          console.log(`  New files: ${changes.added.length}`);
          console.log(`  Missing files: ${changes.removed.length}`);
          console.log(`  Renamed files: ${changes.changed.path.length}`);
          
          let added = this._processFiles(changes.added, (file) => this._db.insert(file));
          let updated = Promise.resolve();
          if (opts.update) {
            updated = this._processFiles(changes.unchanged, (file) => this._db.updateMeta(file));
          }
          let removed = changes.removed.map((file) => this._db.remove(file.id));
          let renamed = changes.changed.path.map((file) => this._db.setPath(file.id, file.path));
          
          return Promise.all([added, updated, removed, renamed]);
        });
  }
  
  _processFiles(files, onEach) {
    let count = 1;
    let result = Promise.resolve();
    
    for (let file of files) {
      result = result.then(() => {
        console.log("[Sync]", `${count++}/${files.length} - Processing ${file.path}`);
        
        let shotMaker = new ShotMaker(file.path);
        let preview = shotMaker.create();
        let meta = shotMaker.getMetaData();
        
        return Promise.all([preview, meta])
            .then((data) => {
              let meta = data[1];
              file.preview = data[0];
              file.stats.bitrate = meta.bitrate;
              file.stats.duration = meta.duration;
              file.stats.fps = meta.fps;
              file.stats.height = meta.height;
              file.stats.width = meta.width;
              return onEach(file);
            })
            .catch((err) => console.error("Error processing file", file.path));
      });
    }
    
    return result;
  }
}
module.exports.MetaDataSync = MetaDataSync;
