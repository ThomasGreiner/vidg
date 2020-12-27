"use strict";

const path = require("path");
const sqlite = require("sqlite3").Database;
const trash = require("trash");
const {promisify} = require("util");

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
  
  _exec(db, method, ...args) {
    db = db || this._db;
    return promisify(db[method].bind(db))(...args);
  }
  
  async getAllFiles() {
    let files = await this._exec(null, "all", `
      SELECT id, path, coalesce(length(preview), 0), rating, stats_size
      FROM files
    `);
    return this._normalizeFiles(files);
  }
  
  async getFileIndex() {
    // TODO: don't order results
    let files = await this._exec(null, "all", `
      SELECT
        id, rating,
        stats_bitrate, stats_colors, stats_created, stats_duration, stats_size
      FROM files
      ORDER BY rating ASC, stats_size DESC
    `);
    return this._normalizeFiles(files);
  }
  
  // TODO: remove after migrating databases
  async getFilesWithoutColors() {
    let files = await this._exec(null, "all", `
      SELECT id, path, preview
      FROM files
      WHERE stats_colors IS NULL
    `);
    return this._normalizeFiles(files);
  }
  
  async getIncompleteFiles() {
    let files = await this._exec(null, "all", `
      SELECT id, path
      FROM files
      WHERE preview = ''
    `);
    return this._normalizeFiles(files);
  }
  
  async getPlaylist() {
    let {query = "", rating = 0} = this._playlist || {};
    
    let stmt = this._db.prepare(`
      SELECT path
      FROM files
      WHERE rating >= ?
      AND path LIKE ?
    `);
    let files = await this._exec(stmt, "all", [rating, `%${query}%`]);
    return files.map((file) => this.toAbsolutePath(file.path));
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
    let stmt = this._db.prepare(`
      SELECT id
      FROM files
      WHERE path LIKE ?
      ORDER BY stats_size DESC
    `);
    let files = await this._exec(stmt, "all", [`%${query}%`]);
    return this._normalizeFiles(files);
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
  
  async _update(id, key, value) {
    let stmt = this._db.prepare(`
      UPDATE files
      SET ${key} = $value
      WHERE id = $id
    `);
    await this._exec(stmt, "run", {$id: id, $value: value});
  }
  
  async emptyTrash() {
    let files = await this._exec(null, "all", `
      SELECT path
      FROM files
      WHERE rating = -1
    `);
    let filepaths = files.map((file) => this.toAbsolutePath(file.path));
    await trash(filepaths)
    await this._exec(null, "run", `
      DELETE FROM files
      WHERE rating = -1;
      VACUUM;
    `);
  }
  
  async get(id) {
    let stmt = this._db.prepare(`
      SELECT *
      FROM files
      WHERE id = $id
    `);
    let file = await this._exec(stmt, "get", {$id: id});
    return this._normalizeFile(file);
  }
  
  async insert(file) {
    let stmt = this._db.prepare(`
      INSERT INTO files(
        id, path, preview, rating, stats_bitrate, stats_colors, stats_created,
        stats_duration, stats_fps, stats_height, stats_size, stats_width
      ) VALUES (
        $id, $path, $preview, 0, $bitrate, $colors, $created, $duration, $fps,
        $height, $size, $width
      )
    `);
    await this._exec(stmt, "run", {
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
    let stmt = this._db.prepare(`
      DELETE FROM files
      WHERE id = $id
    `);
    await this._exec(stmt, "run", {$id: id});
  }
  
  async resetMeta() {
    await this._exec(null, "run", `
      UPDATE files SET
        preview = '',
        stats_bitrate = 0,
        stats_colors = '',
        stats_duration = 0,
        stats_fps = 0,
        stats_height = 0,
        stats_width = 0
    `);
  }
  
  async setColors(id, colors) {
    await this._update(id, "stats_colors", colors);
  }
  
  async setPath(id, path) {
    await this._update(id, "path", this.toRelativePath(path));
  }
  
  setPlaylist(options) {
    this._playlist = options;
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
  
  async updateMeta(file) {
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
    await this._exec(stmt, "run", {
      $bitrate: file.stats.bitrate,
      $colors: file.stats.colors,
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
