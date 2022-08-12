const path = require("path");
const sqlite = require("sqlite3");
const {promisify} = require("util");

import * as io from "./io.js";

class Database {
  constructor(baseDir) {
    this._baseDir = baseDir;
    this._db = new sqlite.Database(path.join(baseDir, ".vidg.sqlite"));
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
  
  _exec(db, method, ...args) {
    db = db || this._db;
    return promisify(db[method].bind(db))(...args);
  }
  
  async _run(query, args) {
    if (args) {
      let stmt = this._db.prepare(query);
      await this._exec(stmt, "run", args);
    } else {
      await this._exec(null, "run", query);
    }
  }
  
  async _getFile(query, args) {
    let stmt = this._db.prepare(query);
    let file = await this._exec(stmt, "get", args);
    return this._normalizeFile(file);
  }
  
  async _getFiles(query, args) {
    let files;
    if (args) {
      let stmt = this._db.prepare(query);
      files = await this._exec(stmt, "all", args);
    } else {
      files = await this._exec(null, "all", query);
    }
    return files.map((file) => this._normalizeFile(file));
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
  
  async _update(id, key, value) {
    await this._run(`
      UPDATE files
      SET ${key} = $value
      WHERE id = $id
    `, {$id: id, $value: value});
  }
  
  async getAllFiles() {
    let files = await this._getFiles(`
      SELECT id, path, coalesce(length(preview), 0), rating, stats_size
      FROM files
    `);
    return files;
  }
  
  async getFileIndex() {
    // TODO: don't order results
    let files = await this._getFiles(`
      SELECT
        id, rating,
        stats_bitrate, stats_colors, stats_created, stats_duration, stats_size
      FROM files
      ORDER BY rating ASC, stats_size DESC
    `);
    return files;
  }
  
  async getRanges() {
    let [ranges] = await this._exec(null, "all", `
      SELECT
        min(stats_bitrate) AS min_bitrate, max(stats_bitrate) AS max_bitrate,
        min(stats_created) AS min_created, max(stats_created) AS max_created,
        min(stats_duration) AS min_duration, max(stats_duration) AS max_duration,
        min(stats_height) AS min_height, max(stats_height) AS max_height,
        min(stats_size) AS min_size, max(stats_size) AS max_size,
        min(stats_width) AS min_width, max(stats_width) AS max_width
      FROM files
    `);
    return {
      bitrate: {min: ranges.min_bitrate, max: ranges.max_bitrate},
      created: {min: ranges.min_created, max: ranges.max_created},
      duration: {min: ranges.min_duration, max: ranges.max_duration},
      height: {min: ranges.min_height, max: ranges.max_height},
      size: {min: ranges.min_size, max: ranges.max_size},
      width: {min: ranges.min_width, max: ranges.max_width}
    };
  }
  
  async search(query) {
    // TODO: don't order results
    let files = await this._getFiles(`
      SELECT id
      FROM files
      WHERE path LIKE ?
      ORDER BY stats_size DESC
    `, [`%${query}%`]);
    return files;
  }
  
  async emptyTrash() {
    let files = await this._getFiles(`
      SELECT path
      FROM files
      WHERE rating = -1
    `);
    let filepaths = files.map((file) => file.path);
    await io.emptyTrash(filepaths);
    await this._exec(null, "run", `
      DELETE FROM files
      WHERE rating = -1;
      VACUUM;
    `);
  }
  
  async get(id) {
    let file = await this._getFile(`
      SELECT *
      FROM files
      WHERE id = $id
    `, {$id: id});
    return file;
  }
  
  async insert(file) {
    await this._run(`
      INSERT INTO files(
        id, path, preview, rating, stats_bitrate, stats_colors, stats_created,
        stats_duration, stats_fps, stats_height, stats_size, stats_width
      ) VALUES (
        $id, $path, $preview, 0, $bitrate, $colors, $created, $duration, $fps,
        $height, $size, $width
      )
    `, {
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
    });
  }
  
  async remove(id) {
    await this._run(`
      DELETE FROM files
      WHERE id = $id
    `, {$id: id});
  }
  
  async setPath(id, path) {
    await this._update(id, "path", this.toRelativePath(path));
  }
  
  async setRating(id, rating) {
    await this._update(id, "rating", rating);
  }
  
  toAbsolutePath(relPath) {
    return path.join(this._baseDir, relPath);
  }
  
  toRelativePath(absPath) {
    return path.relative(this._baseDir, absPath);
  }
}

export async function open(baseDir) {
  return new Database(baseDir);
}
