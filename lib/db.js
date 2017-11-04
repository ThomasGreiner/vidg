"use strict";

const path = require("path");
const sqlite = require("sqlite3").Database;
const trash = require("trash");

class Database {
  _run(resultCount, query, ...args) {
    return new Promise((resolve, reject) => {
      if (!this._statements.has(query)) {
        this._statements.set(query, this._db.prepare(query));
      }
      
      let method = "all";
      if (resultCount == 0) {
        method = "run";
      } else if (resultCount == 1) {
        method == "get";
      }
      
      args.push((err, result) => {
        if (err) {
          reject(err);
        } else {
          resolve(result);
        }
      });
      
      this._statements.get(query)[method](...args);
    });
  }
  
  constructor(baseDir) {
    this._baseDir = baseDir;
    this._playlist = null;
    this._statements = new Map();
    this._db = new sqlite(path.join(baseDir, ".vidg.sqlite"));
    this._run(0, `
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
  }
  
  getAllFiles() {
    return this._run(2, `
      SELECT id, path, coalesce(length(preview), 0), rating, stats_size
      FROM files
    `).then((files) => this._normalizeFiles(files));
  }
  
  getFileIndex() {
    return this._run(2, `
      SELECT
        id, rating,
        stats_bitrate, stats_created, stats_duration, stats_size
      FROM files
      ORDER BY rating ASC, stats_size DESC
    `).then((files) => this._normalizeFiles(files));
  }
  
  getIncompleteFiles() {
    return this._run(2, `
      SELECT id, path
      FROM files
      WHERE preview = ''
    `).then((files) => this._normalizeFiles(files));
  }
  
  getPlaylist() {
    let {rating = 0} = this._playlist || {};
    
    return this._run(2, `
      SELECT path
      FROM files
      WHERE rating >= ?
    `, [rating])
      .then((files) => {
        return files.map((file) => this.toAbsolutePath(file.path));
      });
  }
  
  getRanges() {
    return this._run(2, `
      SELECT
        min(stats_bitrate) AS min_bitrate, max(stats_bitrate) AS max_bitrate,
        min(stats_created) AS min_created, max(stats_created) AS max_created,
        min(stats_duration) AS min_duration, max(stats_duration) AS max_duration,
        min(stats_size) AS min_size, max(stats_size) AS max_size
      FROM files
    `).then(([ranges]) => {
      return {
        bitrate: {min: ranges.min_bitrate, max: ranges.max_bitrate},
        created: {min: ranges.min_created, max: ranges.max_created},
        duration: {min: ranges.min_duration, max: ranges.max_duration},
        size: {min: ranges.min_size, max: ranges.max_size}
      };
    });
  }
  
  search(query) {
    return this._run(2, `
      SELECT id, rating, stats_created, stats_duration, stats_size
      FROM files
      WHERE path LIKE ?
      ORDER BY stats_size DESC
    `, [`%${query}%`])
      .then((files) => this._normalizeFiles(files));
  }
  
  _normalizeFile(file) {
    return {
      id: file.id,
      path: file.path && this.toAbsolutePath(file.path),
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
    return this._run(0, `
      UPDATE files
      SET ${key} = $value
      WHERE id = $id
    `, {
      $id: id,
      $value: value
    });
  }
  
  emptyTrash() {
    return this._run(2, `
      SELECT path
      FROM files
      WHERE rating = -1
    `).then((files) => {
        let filepaths = files.map((file) => this.toAbsolutePath(file.path));
        return trash(filepaths);
      })
      .then(() => {
        return this._run(0, `
          DELETE FROM files
          WHERE rating = -1;
          VACUUM;
        `);
      });
  }
  
  get(id) {
    return this._run(1, `
      SELECT *
      FROM files
      WHERE id = $id
    `, {$id: id}).then((file) => this._normalizeFile(file));
  }
  
  insert(file) {
    return this._run(0, `
      INSERT INTO files(
        id, path, preview, rating,
        stats_bitrate, stats_created, stats_duration, stats_fps, stats_height,
        stats_size, stats_width
      ) VALUES (
        $id, $path, $preview, 0, $bitrate, $created, $duration, $fps, $height,
        $size, $width
      )
    `, {
      $id: file.id,
      $path: this.toRelativePath(file.path),
      $preview: file.preview,
      $bitrate: file.stats.bitrate,
      $created: file.stats.created,
      $duration: file.stats.duration,
      $fps: file.stats.fps,
      $height: file.stats.height,
      $size: file.stats.size,
      $width: file.stats.width
    });
  }
  
  remove(id) {
    return this._run(0, `
      DELETE FROM files
      WHERE id = $id
    `, {$id: id});
  }
  
  resetMeta() {
    return this._run(0, `
      UPDATE files SET
        preview = '',
        stats_bitrate = 0,
        stats_duration = 0,
        stats_fps = 0,
        stats_height = 0,
        stats_width = 0
    `);
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
    return this._run(0, `
      UPDATE files SET
        preview = $preview,
        stats_bitrate = $bitrate,
        stats_duration = $duration,
        stats_fps = $fps,
        stats_height = $height,
        stats_width = $width
      WHERE id = $id
    `, {
      $bitrate: file.stats.bitrate,
      $duration: file.stats.duration,
      $fps: file.stats.fps,
      $id: file.id,
      $height: file.stats.height,
      $preview: file.preview,
      $width: file.stats.width
    });
  }
}

module.exports.open = (dbPath) => new Database(dbPath);
