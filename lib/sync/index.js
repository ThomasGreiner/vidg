"use strict";

const fs = require("fs").promises;
const path = require("path");

const utils = require("./utils");
const {ShotMaker} = require("./shot");

const {info: INFO, log: LOG, warn: WARN} = console;
// TODO: remove support for 3gp, asf, divx, mp2t and quicktime
// TODO: add support for webm
const validVideoExtensions = new Set([
  "3gp",
  "asf",
  "avi",
  "divx",
  "m4v",
  "mkv",
  "mov",
  "mp2t",
  "mp4",
  "mpeg",
  "mpg",
  "ogv",
  "quicktime",
  "webm",
  "wmv"
]);
const validNonVideoExtensions = new Set([
  "gif",
  "jpeg",
  "jpg",
  "png",
  "sqlite",
  "srt",
  "txt",
  "webp"
]);
const reIgnore = /\/tools\//;

function log(fn, ...args) {
  if (process.env.VIDG_MODE == "test")
    return;
  
  fn(...args);
}

async function readDirectory(dir) {
  let filenames = await fs.readdir(dir);
  let promisedNestedFiles = filenames.map(async (filename) => {
    let filepath = path.join(dir, filename);
    let stat = await fs.lstat(filepath);
    if (stat.isSymbolicLink()) {
      console.warn("  Ignoring symbolic link", filepath);
      return [];
    }
    
    if (stat.isDirectory()) {
      return readDirectory(filepath);
    }
  
    return [{
      id: stat.ino,
      path: filepath,
      stats: {
        bitrate: null,
        created: +stat.birthtime,
        duration: null,
        fps: null,
        height: null,
        size: stat.size,
        width: null
      }
    }];
  });
  
  let nestedFiles = await Promise.all(promisedNestedFiles);
  return nestedFiles.reduce(
    (files, subdirFiles) => files.concat(subdirFiles),
    []
  );
}

function filterInvalidFilenames(files) {
  return files.filter((file) => {
    if (reIgnore.test(file.path))
      return false;
    
    let ext = path.extname(file.path).substr(1).toLowerCase();
    let isValid = validVideoExtensions.has(ext);
    if (!isValid && !validNonVideoExtensions.has(ext)) {
      log(WARN, `Unknown file type '${ext.toUpperCase()}': ${file.path}`);
    }
    return isValid;
  });
}

class MetaDataSync {
  constructor(db) {
    this._db = db;
  }
  
  async sync(inputDir) {
    log(INFO, "Syncing files");
    
    let files = await readDirectory(inputDir);
    let foundFiles = filterInvalidFilenames(files);
    log(LOG, `  Found files: ${foundFiles.length}`);
    
    let knownFiles = await this._db.getAllFiles();
    let changes = utils.diff("id", knownFiles, foundFiles, ["path"]);
    log(LOG, `  New files: ${changes.added.length}`);
    log(LOG, `  Missing files: ${changes.removed.length}`);
    log(LOG, `  Renamed files: ${changes.changed.path.length}`);
    
    // Remove missing files
    log(INFO, "Removing missing files");
    await Promise.all(changes.removed.map((file) => this._db.remove(file.id)));
    
    // Add new files
    log(INFO, "Adding new files");
    await this._processFiles(changes.added, (file) => this._db.insert(file));
    
    // Update moved files
    await Promise.all(changes.changed.path.map((file) => this._db.setPath(file.id, file.path)));
  }
  
 async  _processFiles(files, onEach) {
    let count = 1;
    
    for (let file of files) {
      log(LOG, "[Sync]", `${count++}/${files.length} - Processing ${file.path}`);
      
      try {
        let shotMaker = new ShotMaker(file.path);
        
        let [meta, preview] = await Promise.all([
          shotMaker.getMetaData(),
          shotMaker.create()
        ]);
        
        file.preview = preview;
        file.stats.bitrate = meta.bitrate;
        file.stats.colors = ShotMaker.getColors(preview);
        file.stats.duration = meta.duration;
        file.stats.fps = meta.fps;
        file.stats.height = meta.height;
        file.stats.width = meta.width;
        await onEach(file);
      } catch(ex) {
        console.error("Error processing file", file.path)
      }
    }
  }
}
module.exports.MetaDataSync = MetaDataSync;
