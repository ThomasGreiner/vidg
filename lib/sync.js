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
    return this._readDirectory(this._inputDir)
        .then((filenames) => this._filterInvalidFilenames(filenames))
        .then((filenames) => {
          console.log(`  Found ${filenames.length} files`);
          let files = filenames.map((filename) => {
            let filepath = path.join(this._inputDir, filename);
            return getFileId(filepath).then((id) => [id, filepath]);
          });
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
          let result = Promise.resolve();
          if (opts.meta) {
            console.info("Syncing meta data");
            console.warn("  NYI");
          }
          if (opts.thumbnail) {
            console.info("Creating thumbnails");
            let filepaths = changes.added.map((file) => ({id: file[0], path: file[1]}));
            result = result.then(this._createNextThumbnail(filepaths))
                .then(() => console.log("  Done"));
          }
          return result;
        })
        .then(() => this._refresh());
  }
  
  // TODO: output absolute instead of relative file names
  _readDirectory(dir) {
    return new Promise((resolve, reject) => {
      fs.readdir(dir, (err, filenames) => {
        if (err) {
          reject(err);
          return;
        }
        
        let promises = filenames.map((filename) => {
          return new Promise((resolve, reject) => {
            let filepath = path.join(dir, filename);
            fs.stat(filepath, (err, stat) => {
              if (err) {
                reject(err);
              } else if (stat.isDirectory()) {
                resolve(this._readDirectory(filepath));
              } else {
                resolve([path.relative(this._inputDir, filepath)]);
              }
            });
          });
        });
        
        Promise.all(promises)
            .then((dirFiles) => {
              let allFiles = dirFiles.reduce((allFiles, subdirFiles) =>
                  allFiles.concat(subdirFiles), []);
              resolve(allFiles);
            })
            .catch(reject);
      });
    });
  }
  
  _filterInvalidFilenames(filenames) {
    let promises = filenames.map((filename) => {
      return new Promise((resolve, reject) => {
        let ext = path.extname(filename).substr(1).toLowerCase();
        if (!videoExtensions.has(ext)) {
          resolve(null);
          return;
        }
        
        fs.stat(path.join(this._inputDir, filename), (err, stat) =>
            resolve((err || stat.isDirectory()) ? null : filename));
      });
    });
    return Promise.all(promises)
        .then((filenames) => filenames.filter((filename) => !!filename));
  }
  
  _createNextThumbnail(files) {
    return new Promise((resolve, reject) => {
      if (!files.length) {
        resolve();
        return;
      }
      
      let resolveNext = (err) => {
        if (err) {
          console.error(err.stack.red);
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
