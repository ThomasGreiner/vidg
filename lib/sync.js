"use strict";

const fs = require("fs");
const path = require("path");

const utils = require("./utils");
const {ShotMaker} = require("./shot");

const {info: INFO, log: LOG} = console;
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

function log(fn, ...args) {
  if (process.env.VIDG_MODE == "test")
    return;
  
  fn(...args);
}

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
    log(INFO, "Syncing files");
    return readDirectory(opts.inputDir)
        .then(filterInvalidFilenames)
        .then((foundFiles) => {
          log(LOG, `  Found files: ${foundFiles.length}`);
          return this._db.getAllFiles()
              .then((knownFiles) => utils.diff("id", knownFiles, foundFiles, ["path"]));
        })
        .then((changes) => {
          log(LOG, `  New files: ${changes.added.length}`);
          log(LOG, `  Missing files: ${changes.removed.length}`);
          log(LOG, `  Renamed files: ${changes.changed.path.length}`);
          
          // Remove missing files
          log(INFO, "Removing missing files");
          let processed = Promise.all(changes.removed.map((file) => this._db.remove(file.id)));
          
          if (opts.update || opts.forceUpdate) {
            // Update unchanged files
            if (opts.forceUpdate) {
              processed = processed.then(() => this._db.resetMeta());
            }
            processed = processed
                .then(() => this._db.getIncompleteFiles())
                .then((files) => {
                  log(INFO, "Updating existing files");
                  return this._processFiles(files, (file) => this._db.updateMeta(file));
                });
          }
          
          // Add new files
          processed = processed.then(() => {
            log(INFO, "Adding new files");
            return this._processFiles(changes.added, (file) => this._db.insert(file));
          });
          
          // Update moved files
          let renamed = changes.changed.path.map((file) => this._db.setPath(file.id, file.path));
          
          return Promise.all([processed, renamed]);
        });
  }
  
  _processFiles(files, onEach) {
    let count = 1;
    let result = Promise.resolve();
    
    for (let file of files) {
      result = result.then(() => {
        log(LOG, "[Sync]", `${count++}/${files.length} - Processing ${file.path}`);
        
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
