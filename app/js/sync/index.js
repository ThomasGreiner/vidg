const {promises: fs} = require("fs");
const path = require("path");

import emitter from "./events.js";
import {ShotMaker} from "./shot.js";
import * as utils from "./utils.js";

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
      console.warn(`Unknown file type '${ext.toUpperCase()}': ${file.path}`);
    }
    return isValid;
  });
}

export class MetaDataSync {
  constructor(db) {
    this._db = db;
  }
  
  async sync(inputDir) {
    console.group("Syncing files");
    emitter.emit("start");
    
    let files = await readDirectory(inputDir);
    let foundFiles = filterInvalidFilenames(files);
    console.log(`Found files: ${foundFiles.length}`);
    emitter.emit("found", foundFiles.length);
    
    let knownFiles = await this._db.getAllFiles();
    let changes = utils.diff("id", knownFiles, foundFiles, ["path"]);
    console.log(`New files: ${changes.added.length}`);
    console.log(`Missing files: ${changes.removed.length}`);
    console.log(`Renamed files: ${changes.changed.path.length}`);
    emitter.emit("changes", {
      added: changes.added.length,
      found: foundFiles.length,
      moved: changes.changed.path.length,
      removed: changes.removed.length
    });
    
    // Remove missing files
    console.group("Removing missing files");
    await Promise.all(changes.removed.map((file) => this._db.remove(file.id)));
    console.groupEnd();
    
    // Add new files
    console.group("Adding new files");
    await this._processFiles(changes.added, (file) => this._db.insert(file));
    console.groupEnd();
    
    // Update moved files
    await Promise.all(changes.changed.path.map((file) => this._db.setPath(file.id, file.path)));
    
    console.groupEnd();
    emitter.emit("end");
  }
  
  async  _processFiles(files, onEach) {
    let count = 1;
    
    for (let file of files) {
      console.log("[Sync]", `${count++}/${files.length} - Processing ${file.path}`);
      emitter.emit("process", file.path);
      
      try {
        let shotMaker = new ShotMaker(file.path);
        
        let [meta, preview] = await Promise.all([
          shotMaker.getMetaData(),
          shotMaker.create()
        ]);
        
        file.preview = preview;
        file.stats.bitrate = meta.bitrate;
        file.stats.colors = await ShotMaker.getColors(preview);
        file.stats.duration = meta.duration;
        file.stats.fps = meta.fps;
        file.stats.height = meta.height;
        file.stats.width = meta.width;
        await onEach(file);
      } catch(ex) {
        console.error("Error processing file", file.path);
        emitter.emit("error", `Error processing file: ${file.path}`);
      }
    }
  }
}
