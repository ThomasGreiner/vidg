"use strict";

const fs = require("fs");
const path = require("path");
const trash = require("trash");

const db = require("./db");
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
                size: stat.size
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
  constructor(inputDir) {
    this._db = db.open(inputDir);
    this._inputDir = inputDir;
  }
  
  _normalizeFiles(files) {
    return files.map((file) => {
      let filepath = (path.isAbsolute(file.path)) ? file.path : path.join(this._inputDir, file.path);
      return {
        id: file.id || file._id,
        absPath: filepath,
        relPath: path.relative(this._inputDir, filepath),
        size: file.size || file.stats.size
      };
    });
  }
  
  emptyTrash() {
    return this._db.filesToRemove
        .then((files) => {
          return this._normalizeFiles(files).map((file) => file.absPath);
        })
        .then(trash)
        .then(() => this._db.removeFilesToRemove())
        .then(() => this._refresh());
  }
  
  setRating(file, rating) {
    return this._db.setRating(file.id, rating)
        .then(() => file.rating = rating);
  }
  
  sync(opts) {
    console.info("Syncing files");
    return readDirectory(this._inputDir)
        .then(filterInvalidFilenames)
        .then((foundFiles) => {
          console.log(`  Found files: ${foundFiles.length}`);
          return this._db.files
              .then((knownFiles) => {
                foundFiles = this._normalizeFiles(foundFiles);
                knownFiles = this._normalizeFiles(knownFiles);
                return utils.diff("id", knownFiles, foundFiles, ["relPath"]);
              });
        })
        .then((changes) => {
          console.log(`  New files: ${changes.added.length}`);
          console.log(`  Missing files: ${changes.removed.length}`);
          console.log(`  Renamed files: ${changes.changed.relPath.length}`);
          let results = [];
          if (opts.meta) {
            let renamed = this._renameFiles(changes.changed.relPath);
            let removed = this._removeFiles(changes.removed);
            results = results.concat(renamed).concat(removed);
          }
          if (opts.preview) {
            let result = this._createNextPreview(changes.added);
            results.push(result);
          }
          return Promise.all(results);
        })
        .then(() => this._refresh());
  }
  
  _renameFiles(files) {
    return files.map((file) => {
      return this._db.setPath(file.id, file.relPath)
          .then(() => console.log("[Sync]", `Renamed to ${file.relPath}`))
          .catch((err) => console.error(err));
    });
  }
  
  _removeFiles(files) {
    return files.map((file) => {
      return this._db.remove(file.id)
          .then(() => console.log("[Sync]", `Removed ${file.relPath}`))
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
      
      console.log("[Preview]", `${files.length + 1} remaining - Processing ${file.relPath}`);
      let shotMaker = new ShotMaker(file.absPath);
      shotMaker.create((err, dataUri) => {
        if (err) {
          resolveNext(err);
          return;
        }
        
        this._db.insert({
          id: file.id,
          path: file.relPath,
          preview: dataUri,
          rating: 0,
          stats: {
            size: file.size
          }
        })
            .then(() => resolveNext(null))
            .catch((err) => resolveNext(err));
      });
    });
  }
  
  _refresh() {
    return this._db.files
        .then((files) => {
          return files.sort((a, b) => {
            if (b < a)
              return 1;
            if (a < b)
              return -1;
            return 0;
          });
        })
        .then((files) => {
          for (let file of files) {
            file.path = path.join(this._inputDir, file.path);
          }
          this.files = files;
        });
  }
}
module.exports.MetaDataSync = MetaDataSync;
