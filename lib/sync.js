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
          fs.stat(filepath, (err, stat) => {
            if (err) {
              reject(err);
            } else if (stat.isDirectory()) {
              resolve(readDirectory(filepath));
            } else {
              resolve([{
                id: stat.ino,
                path: filepath,
                stats: {
                  size: stat.size
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
          let results = [];
          if (opts.meta) {
            let renamed = this._renameFiles(changes.changed.path);
            let removed = this._removeFiles(changes.removed);
            results = results.concat(renamed).concat(removed);
          }
          if (opts.preview) {
            let result = this._createNextPreview(changes.added);
            results.push(result);
          }
          return Promise.all(results);
        });
  }
  
  _renameFiles(files) {
    return files.map((file) => {
      return this._db.setPath(file.id, file.path)
          .then(() => console.log("[Sync]", `Renamed to ${file.path}`))
          .catch((err) => console.error(err));
    });
  }
  
  _removeFiles(files) {
    return files.map((file) => {
      return this._db.remove(file.id)
          .then(() => console.log("[Sync]", `Removed ${file.path}`))
          .catch((err) => console.error(err));
    });
  }
  
  _createNextPreview(files) {
    return new Promise((resolve, reject) => {
      if (!files.length) {
        resolve();
        return;
      }
      
      let resolveNext = (err) => {
        if (err) {
          console.error(err.stack);
        }
        resolve(this._createNextPreview(files));
      };
      
      let file = files.shift();
      if (!file) {
        resolveNext(null);
        return;
      }
      
      // TODO: check if file already has preview image
      
      console.log("[Preview]", `${files.length + 1} remaining - Processing ${file.path}`);
      let shotMaker = new ShotMaker(file.path);
      shotMaker.create((err, dataUri) => {
        if (err) {
          resolveNext(err);
          return;
        }
        
        file.preview = dataUri;
        this._db.insert(file)
            .then(() => resolveNext(null))
            .catch((err) => resolveNext(err));
      });
    });
  }
}
module.exports.MetaDataSync = MetaDataSync;
