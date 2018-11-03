"use strict";

const db = new Map();

class Database {
  constructor(path) {
    this.resetMeta();
    
    let files = db.get(path);
    for (let file of files) {
      this.insert(file);
    }
  }
  
  async getAllFiles() {
    return Array.from(this._db.values());
  }
  
  async insert(file) {
    this._db.set(file.id, Object.assign({}, file));
  }
  
  async remove(id) {
    this._db.delete(id);
  }
  
  async resetMeta() {
    this._db = new Map();
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
