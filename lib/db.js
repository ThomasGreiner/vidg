"use strict";

const path = require("path");
const sqlite = require("sqlite3").Database;
const trash = require("trash");

class Database {
  constructor(baseDir) {
    this._baseDir = baseDir;
    this._playlist = null;
    this._db = new sqlite(path.join(baseDir, ".vidg.sqlite"));
    this._db.run(`
      CREATE TABLE IF NOT EXISTS files(
        id INT PRIMARY KEY,
        path TEXT,
        preview TEXT,
        rating INT,
        stats_bitrate INT,
        stats_colors TEXT,
        stats_created INT,
        stats_duration INT,
        stats_fps INT,
        stats_height INT,
        stats_size INT,
        stats_width INT
      )
    `);
  }
  
  getAllFiles() {
    return new Promise((resolve, reject) => {
      this._db.all(`
        SELECT id, path, coalesce(length(preview), 0), rating, stats_size
        FROM files
      `, (err, files) => {
        if (err) {
          reject(err);
        } else {
          resolve(this._normalizeFiles(files));
        }
      });
    });
  }
  
  getFileIndex() {
    return new Promise((resolve, reject) => {
      // TODO: don't order results
      this._db.all(`
        SELECT
          id, rating,
          stats_bitrate, stats_colors, stats_created, stats_duration, stats_size
        FROM files
        ORDER BY rating ASC, stats_size DESC
      `, (err, files) => {
        if (err) {
          reject(err);
        } else {
          resolve(this._normalizeFiles(files));
        }
      });
    });
  }
  
  // TODO: remove after migrating databases
  getFilesWithoutColors() {
    return new Promise((resolve, reject) => {
      this._db.all(`
          SELECT id, path, preview
          FROM files
          WHERE stats_colors IS NULL
        `, (err, files) => {
        if (err) {
          reject(err);
        } else {
          resolve(this._normalizeFiles(files));
        }
      });
    });
  }
  
  getIncompleteFiles() {
    return new Promise((resolve, reject) => {
      this._db.all(`
        SELECT id, path
        FROM files
        WHERE preview = ''
      `, (err, files) => {
        if (err) {
          reject(err);
        } else {
          resolve(this._normalizeFiles(files));
        }
      });
    });
  }
  
  getPlaylist() {
    return new Promise((resolve, reject) => {
      let {query = "", rating = 0} = this._playlist || {};
      
      let stmt = this._db.prepare(`
        SELECT path
        FROM files
        WHERE rating >= ?
        AND path LIKE ?
      `);
      stmt.all([rating, `%${query}%`], (err, files) => {
        if (err) {
          reject(err);
        } else {
          resolve(files.map((file) => this.toAbsolutePath(file.path)));
        }
      });
    });
  }
  
  getRanges() {
    return new Promise((resolve, reject) => {
      this._db.all(`
        SELECT
          min(stats_bitrate) AS min_bitrate, max(stats_bitrate) AS max_bitrate,
          min(stats_created) AS min_created, max(stats_created) AS max_created,
          min(stats_duration) AS min_duration, max(stats_duration) AS max_duration,
          min(stats_height) AS min_height, max(stats_height) AS max_height,
          min(stats_size) AS min_size, max(stats_size) AS max_size,
          min(stats_width) AS min_width, max(stats_width) AS max_width
        FROM files
      `, (err, [ranges]) => {
        if (err) {
          reject(err);
        } else {
          resolve({
            bitrate: {min: ranges.min_bitrate, max: ranges.max_bitrate},
            created: {min: ranges.min_created, max: ranges.max_created},
            duration: {min: ranges.min_duration, max: ranges.max_duration},
            height: {min: ranges.min_height, max: ranges.max_height},
            size: {min: ranges.min_size, max: ranges.max_size},
            width: {min: ranges.min_width, max: ranges.max_width}
          });
        }
      });
    });
  }
  
  search(query) {
    return new Promise((resolve, reject) => {
      // TODO: don't order results
      let stmt = this._db.prepare(`
        SELECT id
        FROM files
        WHERE path LIKE ?
        ORDER BY stats_size DESC
      `);
      stmt.all([`%${query}%`], (err, files) => {
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
      path: file.path && this.toAbsolutePath(file.path),
      preview: file.preview,
      rating: file.rating,
      stats: {
        bitrate: file.stats_bitrate,
        colors: (file.stats_colors) ? file.stats_colors.match(/[0-9a-f]{6}/g) : [],
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
      let stmt = this._db.prepare(`
        UPDATE files
        SET ${key} = $value
        WHERE id = $id
      `);
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
      this._db.all(`
        SELECT path
        FROM files
        WHERE rating = -1
      `, (err, files) => {
        if (err) {
          reject(err);
          return;
        }
        
        let filepaths = files.map((file) => this.toAbsolutePath(file.path));
        trash(filepaths)
            .then(() => {
              this._db.run(`
                DELETE FROM files
                WHERE rating = -1;
                VACUUM;
              `, (err) => {
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
      let stmt = this._db.prepare(`
        SELECT *
        FROM files
        WHERE id = $id
      `);
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
          id, path, preview, rating, stats_bitrate, stats_colors, stats_created,
          stats_duration, stats_fps, stats_height, stats_size, stats_width
        ) VALUES (
          $id, $path, $preview, 0, $bitrate, $colors, $created, $duration, $fps,
          $height, $size, $width
        )
      `);
      stmt.run({
        $id: file.id,
        $path: this.toRelativePath(file.path),
        $preview: file.preview,
        $bitrate: file.stats.bitrate,
        $colors: file.stats.colors,
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
      let stmt = this._db.prepare(`
        DELETE FROM files
        WHERE id = $id
      `);
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
          stats_colors = '',
          stats_duration = 0,
          stats_fps = 0,
          stats_height = 0,
          stats_width = 0
      `, (err) => (err) ? reject(err) : resolve());
    });
  }
  
  setColors(id, colors) {
    return this._update(id, "stats_colors", colors);
  }
  
  setPath(id, path) {
    return this._update(id, "path", this.toRelativePath(path));
  }
  
  setPlaylist(options) {
    this._playlist = options;
  }
  
  setRating(id, rating) {
    return this._update(id, "rating", rating);
  }
  
  toAbsolutePath(relPath) {
    return path.join(this._baseDir, relPath);
  }
  
  toRelativePath(absPath) {
    return path.relative(this._baseDir, absPath);
  }
  
  updateMeta(file) {
    return new Promise((resolve, reject) => {
      let stmt = this._db.prepare(`
        UPDATE files SET
          preview = $preview,
          stats_bitrate = $bitrate,
          stats_colors = $colors,
          stats_duration = $duration,
          stats_fps = $fps,
          stats_height = $height,
          stats_width = $width
        WHERE id = $id
      `);
      stmt.run({
        $bitrate: file.stats.bitrate,
        $colors: file.stats.colors,
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
