"use strict";

const path = require("path");
const sqlite = require("sqlite3").Database;
const trash = require("trash");

class Database {
  constructor(baseDir) {
    this._db = new sqlite(path.join(baseDir, ".vidg.sqlite"));
    this._db.run(`
      CREATE TABLE IF NOT EXISTS files(
        id INT PRIMARY KEY,
        path TEXT,
        preview TEXT,
        rating INT,
        stats_bitrate INT,
        stats_created INT,
        stats_duration INT,
        stats_fps INT,
        stats_height INT,
        stats_size INT,
        stats_width INT
      )
    `);
    
    this._getAbsolutePath = (relPath) => path.join(baseDir, relPath);
    this._getRelativePath = (absPath) => path.relative(baseDir, absPath);
  }
  
  get allFiles() {
    return new Promise((resolve, reject) => {
      this._db.all("SELECT id, path, coalesce(length(preview), 0), rating, stats_size FROM files", (err, files) => {
        if (err) {
          reject(err);
        } else {
          resolve(this._normalizeFiles(files));
        }
      });
    });
  }
  
  get comparisons() {
    return new Promise((resolve, reject) => {
      this._db.all(`
        SELECT
          a.id AS a_id, a.rating AS a_rating, a.stats_size AS a_stats_size,
          b.id AS b_id, b.rating AS b_rating, b.stats_size AS b_stats_size
        FROM files AS a
        JOIN files AS b
        WHERE b.stats_size = a.stats_size AND b.id > a.id
        ORDER BY a.id
      `, (err, comparisons) => {
        if (err) {
          reject(err);
          return;
        }
        
        comparisons = comparisons.map((result) => {
          return {
            a: this._normalizeFile({
              id: result.a_id,
              rating: result.a_rating,
              stats_size: result.a_stats_size
            }),
            b: this._normalizeFile({
              id: result.b_id,
              rating: result.b_rating,
              stats_size: result.b_stats_size
            }),
            factors: {size: 1}
          };
        });
        resolve(comparisons);
      });
    });
  }
  
  get fileIndex() {
    return new Promise((resolve, reject) => {
      this._db.all("SELECT id, rating, stats_size FROM files ORDER BY stats_size DESC", (err, files) => {
        if (err) {
          reject(err);
        } else {
          resolve(this._normalizeFiles(files));
        }
      });
    });
  }
  
  get incompleteFiles() {
    return new Promise((resolve, reject) => {
      this._db.all("SELECT id, path FROM files WHERE preview = ''", (err, files) => {
        if (err) {
          reject(err);
        } else {
          resolve(this._normalizeFiles(files));
        }
      });
    });
  }
  
  get topRated() {
    return new Promise((resolve, reject) => {
      this._db.all("SELECT path FROM files WHERE rating >= 4", (err, files) => {
        if (err) {
          reject(err);
        } else {
          resolve(files.map((file) => this._getAbsolutePath(file.path)));
        }
      });
    });
  }
  
  _normalizeFile(file) {
    return {
      id: file.id,
      path: file.path && this._getAbsolutePath(file.path),
      preview: file.preview,
      rating: file.rating,
      stats: {
        bitrate: file.stats_bitrate,
        created: file.stats_created,
        duration: file.stats_duration,
        height: file.stats_height,
        size: file.stats_size,
        width: file.stats_width
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
              this._db.run("DELETE FROM files WHERE rating = -1; VACUUM;", (err) => {
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
      let stmt = this._db.prepare(`
        INSERT INTO files(
          id, path, preview, rating, stats_bitrate, stats_created, stats_duration, stats_fps, stats_height, stats_size, stats_width
        ) VALUES (
          $id, $path, $preview, 0, $bitrate, $created, $duration, $fps, $height, $size, $width
        )
      `);
      stmt.run({
        $id: file.id,
        $path: this._getRelativePath(file.path),
        $preview: file.preview,
        $bitrate: file.stats.bitrate,
        $created: file.stats.created,
        $duration: file.stats.duration,
        $fps: file.stats.fps,
        $height: file.stats.height,
        $size: file.stats.size,
        $width: file.stats.width
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
  
  resetMeta() {
    return new Promise((resolve, reject) => {
      let stmt = this._db.run(`
        UPDATE files SET
          preview = '',
          stats_bitrate = 0,
          stats_duration = 0,
          stats_fps = 0,
          stats_height = 0,
          stats_width = 0
      `, (err) => (err) ? reject(err) : resolve());
    });
  }
  
  setPath(id, path) {
    return this._update(id, "path", this._getRelativePath(path));
  }
  
  setRating(id, rating) {
    return this._update(id, "rating", rating);
  }
  
  updateMeta(file) {
    return new Promise((resolve, reject) => {
      let stmt = this._db.prepare(`
        UPDATE files SET
          preview = $preview,
          stats_bitrate = $bitrate,
          stats_duration = $duration,
          stats_fps = $fps,
          stats_height = $height,
          stats_width = $width
        WHERE id = $id
      `);
      stmt.run({
        $bitrate: file.stats.bitrate,
        $duration: file.stats.duration,
        $fps: file.stats.fps,
        $id: file.id,
        $height: file.stats.height,
        $preview: file.preview,
        $width: file.stats.width
      }, (err) => (err) ? reject(err) : resolve());
    });
  }
}

module.exports.open = (dbPath) => new Database(dbPath);
