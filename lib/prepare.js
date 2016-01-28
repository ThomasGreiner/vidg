"use strict";

const crypto = require("crypto");
const fs = require("fs");
const Nedb = require("nedb");
const path = require("path");
const trash = require("trash");

const ShotMaker = require("./shot").ShotMaker;

const dbFile = ".vidg.nedb";

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
            .then(() => this._clearTrash())
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
    return this._readDirectory()
        .then((filenames) => this._getUntrackedFiles(filenames))
        .then((filenames) => this._createNextScreenshot(filenames))
        .then(() => this._save());
  }
  
  _readDirectory() {
    return new Promise((resolve, reject) => {
      fs.readdir(this._inputDir, (err, filenames) => {
        if (err) {
          reject(err);
        } else {
          resolve(filenames);
        }
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
      
      let filename = filenames.shift();
      if (!filename) {
        resolve(this._createNextScreenshot(filenames));
        return;
      }
      
      console.log(`${filenames.length + 1} remaining - ${filename}`);
      let shotMaker = new ShotMaker(path.join(this._inputDir, filename));
      shotMaker.create((err, dataUri) => {
        if (err) {
          resolve(this._createNextScreenshot(filenames));
          return;
        }
        
        getFileId(path.join(this._inputDir, filename)).then((fileId) => {
          this._db.find({_id: fileId}, (err, files) => {
            if (err) {
              resolve(this._createNextScreenshot(filenames));
              return;
            }
            
            if (files.length) {
              this._db.update({_id: fileId}, {screenshot: dataUri}, (err, count) => {
                resolve(this._createNextScreenshot(filenames));
              });
            } else {
              this._db.insert({
                _id: fileId,
                tags: [],
                name: filename,
                rating: 0,
                screenshot: dataUri
              }, (err, file) => {
                resolve(this._createNextScreenshot(filenames));
              });
            }
          });
        });
      });
    });
  }
  
  _save() {
    return new Promise((resolve, reject) => {
      this._db.find({}).sort({name: 1}).exec((err, files) => {
        if (err) {
          reject(err);
        } else {
          this.files = files;
          resolve({
            inputDir: this._inputDir,
            sync: this
          });
        }
      });
    });
  }
  
  _clearTrash() {
    return new Promise((resolve, reject) => {
      this._db.remove({rating: -1}, (err, count) => {
        if (err) {
          reject(err);
        } else {
          resolve();
        }
      });
    });
  }
}
module.exports.MetaDataSync = MetaDataSync;
