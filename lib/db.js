"use strict";

const Nedb = require("nedb");
const path = require("path");

const dbFile = ".vidg.nedb";

class Database {
  constructor(inputDir) {
    this._db = new Nedb({
      autoload: true,
      filename: path.join(inputDir, dbFile)
    });
  }
  
  get files() {
    return new Promise((resolve, reject) => {
      this._db.find({}, (err, files) => {
        if (err) {
          reject(err);
        } else {
          resolve(files);
        }
      });
    });
  }
  
  get filesToRemove() {
    return new Promise((resolve, reject) => {
      this._db.find({rating: -1}, (err, files) => {
        if (err) {
          reject(err);
        } else {
          resolve(files);
        }
      });
    });
  }
  
  insert(file) {
    return new Promise((resolve, reject) => {
      this._db.insert(file, (err, file) => {
        if (err) {
          reject(err);
        } else {
          resolve();
        }
      });
    });
  }
  
  remove(id) {
    return new Promise((resolve, reject) => {
      this._db.remove({_id: id}, {}, (err, num) => {
        if (err) {
          reject(err);
        } else {
          resolve();
        }
      });
    });
  }
  
  removeFilesToRemove() {
    return new Promise((resolve, reject) => {
      this._db.remove({rating: -1}, (err, num) => {
        if (err) {
          reject(err);
        } else {
          resolve();
        }
      });
    });
  }
  
  update(id, key, value) {
    return new Promise((resolve, reject) => {
      this._db.update({_id: id}, {$set: {[key]: value}}, (err, count) => {
        if (err) {
          reject(err);
        } else {
          resolve();
        }
      });
    });
  }
}

module.exports.open = (dbPath) => new Database(dbPath);
