"use strict";

const path = require("path");
const sqlite = require("sqlite3").Database;

const dbFile = ".vidg.sqlite";

class Database {
  constructor(inputDir) {
    this._db = new sqlite(path.join(inputDir, dbFile));
    this._db.run("CREATE TABLE IF NOT EXISTS files(id INT PRIMARY KEY, path TEXT, preview TEXT, rating INT, stats_size INT)");
  }
  
  get files() {
    return new Promise((resolve, reject) => {
      this._db.all("SELECT * FROM files", (err, files) => {
        if (err) {
          reject(err);
        } else {
          resolve(this._normalizeFiles(files));
        }
      });
    });
  }
  
  get filesToRemove() {
    return new Promise((resolve, reject) => {
      this._db.all("SELECT * FROM files WHERE rating = -1", (err, files) => {
        if (err) {
          reject(err);
        } else {
          resolve(this._normalizeFiles(files));
        }
      });
    });
  }
  
  _normalizeFiles(files) {
    return files.map((file) => {
      return {
        id: file.id,
        path: file.path,
        rating: file.rating,
        preview: file.preview,
        stats: {
          size: file.stats_size
        }
      };
    });
  }
  
  _update(id, key, value) {
    return new Promise((resolve, reject) => {
      let stmt = this._db.prepare(`UPDATE files SET ${key} = $value WHERE id = $id`);
      stmt.run({$id: id, $value: value}, (err) => {
        if (err) {
          reject(err);
        } else {
          resolve();
        }
      });
    });
  }
  
  insert(file) {
    return new Promise((resolve, reject) => {
      let stmt = this._db.prepare("INSERT INTO files(id, path, preview, rating, stats_size) VALUES ($id, $path, $preview, $rating, $size)");
      stmt.run({
        $id: file.id,
        $path: file.path,
        $preview: file.preview,
        $rating: file.rating,
        $size: file.stats.size
      }, (err) => {
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
      let stmt = this._db.prepare("DELETE FROM files WHERE id = $id");
      stmt.run({$id: id}, (err) => {
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
      this._db.run("DELETE FROM files WHERE rating = -1", (err) => {
        if (err) {
          reject(err);
        } else {
          resolve();
        }
      });
    });
  }
  
  setPath(id, path) {
    return this._update(id, "path", path);
  }
  
  setRating(id, rating) {
    return this._update(id, "rating", rating);
  }
}

module.exports.open = (dbPath) => new Database(dbPath);
