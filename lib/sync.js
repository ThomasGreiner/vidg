"use strict";

const fs = require("fs");
const Nedb = require("nedb");
const path = require("path");
const trash = require("trash");

const utils = require("./utils");
const ShotMaker = require("./shot").ShotMaker;

const dbFile = ".vidg.nedb";
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
    this._db = new Nedb({
      autoload: true,
      filename: path.join(inputDir, dbFile)
    });
    this._inputDir = inputDir;
  }
  
  emptyTrash() {
    return new Promise((resolve, reject) => {
      this._db.find({rating: -1}, (err, files) => {
        if (err) {
          reject(err);
          return;
        }
        
        files = files.map((file) => path.join(this._inputDir, file.name));
        trash(files)
            .then(() => {
              return new Promise((resolve, reject) => {
                this._db.remove({rating: -1}, (err, count) => {
                  if (err) {
                    reject(err);
                  } else {
                    resolve();
                  }
                });
              });
            })
            .then(() => this._save())
            .then(resolve)
            .catch(reject);
      });
    });
  }
  
  update(file, key, value) {
    return new Promise((resolve, reject) => {
      this._db.update({_id: file._id}, {$set: {[key]: value}}, (err, count) => {
        if (err) {
          reject(err);
        } else {
          file[key] = value;
          resolve();
        }
      });
    });
  }
  
  sync(opts) {
    console.info("Syncing files");
    return readDirectory(this._inputDir)
        .then(filterInvalidFilenames)
        .then((foundFiles) => {
          console.log(`  Found files: ${foundFiles.length}`);
          foundFiles = foundFiles.map((file) => [file.id, file]);
          
          return new Promise((resolve, reject) => {
            this._db.find({}, (err, knownFiles) => {
              if (err) {
                reject(err);
              } else {
                knownFiles = knownFiles.map((file) => {
                  file = {
                    id: file._id,
                    path: file.path,
                    size: file.stats.size
                  };
                  return [file.id, file];
                });
                resolve(utils.diffMaps(knownFiles, foundFiles, ["path"]));
              }
            });
          });
        })
        .then((changes) => {
          console.log(`  New files: ${changes.added.length}`);
          console.log(`  Missing files: ${changes.removed.length}`);
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
        })
        .then(() => this._refresh());
  }
  
  _renameFiles(files) {
    return files.map((file) => {
      return new Promise((resolve, reject) => {
        this._db.update({_id: file.id}, {$set: {path: file.path}}, {}, (err, num) => {
          if (err) {
            console.error(err);
          } else {
            console.log("[Sync]", `Renamed to ${file.path}`);
          }
          resolve();
        });
      });
    });
  }
  
  _removeFiles(files) {
    return files.map((file) => {
      return new Promise((resolve, reject) => {
        this._db.remove({_id: file.id}, {}, (err, num) => {
          if (err) {
            console.error(err);
          } else {
            console.log("[Sync]", `Removed ${file.path}`);
          }
          resolve();
        });
      });
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
        
        this._db.insert({
          _id: file.id,
          path: file.path,
          preview: dataUri,
          rating: 0,
          stats: {
            size: file.size
          },
          tags: []
        }, (err, file) => resolveNext(err));
      });
    });
  }
  
  _refresh() {
    return new Promise((resolve, reject) => {
      this._db.find({}).sort({name: 1}).exec((err, files) => {
        if (err) {
          reject(err);
        } else {
          this.files = files;
          resolve();
        }
      });
    });
  }
}
module.exports.MetaDataSync = MetaDataSync;
