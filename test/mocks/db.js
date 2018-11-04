"use strict";

const db = new Map();

class Database {
  constructor(path) {
    this._db = new Map();
    
    let files = db.get(path);
    for (let file of files) {
      this.insert(file);
    }
  }
  
  async getAllFiles() {
    return Array.from(this._db.values());
  }
  
  async getIncompleteFiles() {
    let files = await this.getAllFiles();
    return files.filter(({preview}) => !preview);
  }
  
  async insert(file) {
    this._db.set(file.id, Object.assign({}, file));
  }
  
  async remove(id) {
    this._db.delete(id);
  }
  
  async resetMeta() {
    for (let file of this._db.values()) {
      file.preview = null;
    }
  }
  
  async setPath(id, filepath) {
    let file = this._db.get(id);
    file.path = filepath;
  }
  
  async updateMeta(file) {
    this.insert(file);
  }
}

module.exports = (config) => {
  for (let path in config) {
    db.set(path, config[path]);
  }
  
  return {
    open: (path) => new Database(path)
  };
};
