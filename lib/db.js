"use strict";

const path = require("path");
const sqlite = require("sqlite3").Database;
const trash = require("trash");

class Database {
  constructor(baseDir) {
    this._db = new sqlite(path.join(baseDir, ".vidg.sqlite"));
    this._db.run("CREATE TABLE IF NOT EXISTS files(id INT PRIMARY KEY, path TEXT, preview TEXT, rating INT, stats_size INT)");
    
    this._getAbsolutePath = (relPath) => path.join(baseDir, relPath);
    this._getRelativePath = (absPath) => path.relative(baseDir, absPath);
  }
  
  get allFiles() {
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
  
  get fileIndex() {
    return new Promise((resolve, reject) => {
      this._db.all("SELECT id, rating, stats_size FROM files", (err, files) => {
        if (err) {
          reject(err);
        } else {
          resolve(this._normalizeFiles(files));
        }
      });
    });
  }
  
  _normalizeFile(file) {
    return {
      id: file.id,
      path: file.path && this._getAbsolutePath(file.path),
      rating: file.rating,
      preview: file.preview,
      stats: {
        size: file.stats_size
      }
    };
  }
  
  _normalizeFiles(files) {
    return files.map((file) => this._normalizeFile(file));
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
  
  emptyTrash() {
    return new Promise((resolve, reject) => {
      this._db.all("SELECT path FROM files WHERE rating = -1", (err, files) => {
        if (err) {
          reject(err);
          return;
        }
        
        let filepaths = files.map((file) => this._getAbsolutePath(file.path));
        trash(filepaths)
            .then(() => {
              this._db.run("DELETE FROM files WHERE rating = -1", (err) => {
                if (err) {
                  reject(err);
                } else {
                  resolve();
                }
              });
            });
      });
    });
  }
  
  get(id) {
    return new Promise((resolve, reject) => {
      let stmt = this._db.prepare("SELECT * FROM files WHERE id = $id");
      stmt.get({$id: id}, (err, file) => {
        if (err) {
          reject(err);
        } else {
          resolve(this._normalizeFile(file));
        }
      });
    });
  }
  
  insert(file) {
    return new Promise((resolve, reject) => {
      let stmt = this._db.prepare("INSERT INTO files(id, path, preview, rating, stats_size) VALUES ($id, $path, $preview, 0, $size)");
      stmt.run({
        $id: file.id,
        $path: this._getRelativePath(file.path),
        $preview: file.preview,
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
  
  setPath(id, path) {
    return this._update(id, "path", this._getRelativePath(path));
  }
  
  setRating(id, rating) {
    return this._update(id, "rating", rating);
  }
}

module.exports.open = (dbPath) => new Database(dbPath);
