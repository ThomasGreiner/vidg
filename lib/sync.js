"use strict";

const fs = require("fs");
const Nedb = require("nedb");
const path = require("path");
const trash = require("trash");

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
  
  sync() {
    console.log("Syncing files".blue);
    return this._readDirectory(this._inputDir)
        .then((filenames) => {
          return filenames.filter((filename) => {
            let ext = path.extname(filename).substr(1).toLowerCase();
            return videoExtensions.has(ext);
          });
        })
        .then((filenames) => this._getUntrackedFiles(filenames))
        .then((filenames) => this._save(filenames));
  }
  
  syncMetaData(filenames) {
    console.log("Syncing meta data".blue);
    // TODO: NYI
    return Promise.resolve(filenames);
  }
  
  createScreenshots(filenames) {
    console.log("Creating screenshots".blue);
    return this._createNextScreenshot(filenames)
        .then((filenames) => this._save(filenames));
  }
  
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
  
  _getUntrackedFiles(filenames) {
    return Promise.all(filenames.map((filename) => this._checkUntrackedFile(filename)));
  }
  
  _checkUntrackedFile(filename) {
    return new Promise((resolve, reject) => {
      if (filename == dbFile) {
        resolve(null);
        return;
      }
      
      getFileId(path.join(this._inputDir, filename)).then((fileId) => {
        this._db.find({_id: fileId}, (err, files) => {
          if (err) {
            reject();
          } else {
            if (files.length && files[0].screenshot) {
              resolve(null);
              return;
            }
            
            fs.stat(path.join(this._inputDir, filename), (err, stat) => {
              if (err) {
                reject();
              } else {
                resolve(stat.isDirectory() ? null : filename);
              }
            });
          }
        });
      });
    });
  }
  
  _createNextScreenshot(filenames) {
    return new Promise((resolve, reject) => {
      if (!filenames.length) {
        resolve();
        return;
      }
      
      let resolveNext = (err) => {
        if (err) {
          console.error(err.stack.red);
        }
        resolve(this._createNextScreenshot(filenames));
      };
      
      let filename = filenames.shift();
      if (!filename) {
        resolveNext(null);
        return;
      }
      
      console.log(`${filenames.length + 1} remaining - ${filename}`);
      let filepath = path.join(this._inputDir, filename);
      let shotMaker = new ShotMaker(filepath);
      shotMaker.create((err, dataUri) => {
        if (err) {
          resolveNext(err);
          return;
        }
        
        fs.stat(filepath, (err, stat) => {
          if (err) {
            resolveNext(err);
            return;
          }
          
          getFileId(path.join(this._inputDir, filename)).then((fileId) => {
            this._db.find({_id: fileId}, (err, files) => {
              if (err) {
                resolveNext(err);
                return;
              }
              
              if (files.length) {
                this._db.update({_id: fileId}, {screenshot: dataUri},
                    (err, count) => resolveNext(err));
              } else {
                this._db.insert({
                  _id: fileId,
                  tags: [],
                  name: filename,
                  rating: 0,
                  stats: {
                    size: stat.size
                  },
                  screenshot: dataUri
                }, (err, file) => resolveNext(err));
              }
            });
          });
        });
      });
    });
  }
  
  _save(filenames) {
    return new Promise((resolve, reject) => {
      this._db.find({}).sort({name: 1}).exec((err, files) => {
        if (err) {
          reject(err);
        } else {
          this.files = files;
          resolve(filenames);
        }
      });
    });
  }
}
module.exports.MetaDataSync = MetaDataSync;
