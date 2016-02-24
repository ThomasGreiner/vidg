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

function getFileId(filename) {
  return new Promise((resolve, reject) => {
    fs.stat(filename, (err, stat) => {
      if (err) {
        reject(err);
      } else {
        resolve(stat.ino);
      }
    });
  });
}

function readDirectory(dir) {
  return new Promise((resolve, reject) => {
    fs.readdir(dir, (err, filenames) => {
      if (err) {
        reject(err);
        return;
      }
      
      let nestedFilepaths = filenames.map((filename) => {
        return new Promise((resolve, reject) => {
          let filepath = path.join(dir, filename);
          fs.stat(filepath, (err, stat) => {
            if (err) {
              reject(err);
            } else if (stat.isDirectory()) {
              resolve(readDirectory(filepath));
            } else {
              resolve([filepath]);
            }
          });
        });
      });
      
      let filepaths = Promise.all(nestedFilepaths)
          .then((nestedFilepaths) => {
            return nestedFilepaths.reduce((filepaths, subdirFilepaths) =>
                filepaths.concat(subdirFilepaths), []);
          });
      resolve(filepaths);
    });
  });
}

function filterInvalidFilenames(filepaths) {
  return filepaths.filter((filepath) => {
    let ext = path.extname(filepath).substr(1).toLowerCase();
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
        .then((filepaths) => {
          console.log(`  Found ${filepaths.length} files`);
          let files = filepaths.map((filepath) =>
              getFileId(filepath).then((id) => [id, filepath]));
          return Promise.all(files);
        })
        .then((foundFiles) => {
          return new Promise((resolve, reject) => {
            this._db.find({}, (err, knownFiles) => {
              if (err) {
                reject(err);
              } else {
                knownFiles = knownFiles.map((file) => [file._id, file.path]);
                resolve(utils.diffMaps(knownFiles, foundFiles));
              }
            });
          });
        })
        .then((changes) => {
          console.log(`  New files: ${changes.added.length}`);
          console.log(`  Missing files: ${changes.removed.length}`);
          let results = [];
          if (opts.meta) {
            console.info("Syncing meta data");
            console.warn("  NYI");
          }
          if (opts.thumbnail) {
            console.info("Creating thumbnails");
            let filepaths = changes.added.map((file) => ({id: file[0], path: file[1]}));
            let result = this._createNextThumbnail(filepaths)
                .then(() => console.log("  Done"));
            results.push(result);
          }
          return Promise.all(results);
        })
        .then(() => this._refresh());
  }
  
  _createNextThumbnail(files) {
    return new Promise((resolve, reject) => {
      if (!files.length) {
        resolve();
        return;
      }
      
      let resolveNext = (err) => {
        if (err) {
          console.warn(err.stack);
        }
        resolve(this._createNextThumbnail(files));
      };
      
      let file = files.shift();
      if (!file) {
        resolveNext(null);
        return;
      }
      
      // TODO: check if file already has screenshot
      
      console.log(`  ${files.length + 1} remaining - ${file.path}`);
      let shotMaker = new ShotMaker(file.path);
      shotMaker.create((err, dataUri) => {
        if (err) {
          resolveNext(err);
          return;
        }
        
        fs.stat(file.path, (err, stat) => {
          if (err) {
            resolveNext(err);
            return;
          }
          
          this._db.find({_id: file.id}, (err, files) => {
            if (err) {
              resolveNext(err);
              return;
            }
            
            if (files.length) {
              this._db.update({_id: file.id}, {screenshot: dataUri},
                  (err, count) => resolveNext(err));
            } else {
              this._db.insert({
                _id: file.id,
                path: file.path,
                rating: 0,
                stats: {
                  size: stat.size
                },
                screenshot: dataUri,
                tags: []
              }, (err, file) => resolveNext(err));
            }
          });
        });
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
