import {getStatusCharts} from "../ui/charts.js";
import {EventEmitter} from "../events.js";

import {FileCursor} from "./cursor.js";
import * as io from "./io.js";

let db;
let cursor;
let ranges;

async function _getFile(id) {
  const file = await db.get(id);
  
  return {
    ...file,
    path: {
      absolute: file.path,
      relative: db.toRelativePath(file.path)
    }
  }
}

export const events = new EventEmitter([
  "file-changed",
  "index-changed",
  "rating-changed"
]);

export const index = {
  async applyFilters(filters) {
    cursor.filter(null);
    
    for (const key in filters) {
      const value = filters[key];
      
      switch (key) {
        case "duplicate": {
          const getEntryValue = (entry) => {
            let entryValue = entry.stats[value];
            if (value === "colors") {
              entryValue = entryValue.join("");
            }
            return entryValue;
          };
          
          const foundValues = new Set();
          const sameValues = new Set();
          
          cursor.each((entry) => {
            const entryValue = getEntryValue(entry);
            if (foundValues.has(entryValue)) {
              sameValues.add(entryValue);
            } else {
              foundValues.add(entryValue);
            }
          });
          cursor.filter((entry) => sameValues.has(getEntryValue(entry)));
          break;
        }
        case "rating":
        case "ratingmode": {
          const rating = filters.rating || 0;
          const mode = filters.ratingmode || "equal";
          
          cursor.filter((entry) => {
            switch (mode) {
              case "equal":
                return entry.rating === rating;
              case "max":
                return entry.rating <= rating;
              case "min":
                return entry.rating >= rating;
            }
          });
          break;
        }
        case "text": {
          if (!value)
            break;
          
          const fileIndex = await db.search(value);
          const foundIds = new Set(fileIndex.map((entry) => entry.id));
          
          cursor.filter((entry) => foundIds.has(entry.id));
          break;
        }
      }
    }
    
    events.emit("index-changed");
  },
  // TODO: untested
  async emptyTrash() {
    await db.emptyTrash();
    await load(db);
    events.emit("index-changed");
  },
  async getCharts() {
    return getStatusCharts(cursor);
  },
  async getRanges() {
    return ranges;
  },
  async getRatings() {
    return cursor.ratings;
  },
  async sort(key, dir) {
    if (key === "random") {
      cursor.sort(() => Math.random() - 0.5);
    } else {
      cursor.sort((a, b) => {
        const valueA = (key in a) ? a[key] : a.stats[key];
        const valueB = (key in b) ? b[key] : b.stats[key];
        
        if (valueA === valueB)
          return 0;
        
        if (valueA > valueB)
          return (dir === "asc") ? 1 : -1;
        
        return (dir === "asc") ? -1 : 1;
      });
    }
    
    events.emit("index-changed");
  }
};

export const files = {
  async get(fileId) {
    return _getFile(fileId || cursor.current.id);
  },
  next() {
    if (!cursor.hasNext())
      return;
    
    cursor.next();
    events.emit("file-changed");
  },
  async open() {
    const file = await db.get(cursor.current.id);
    await io.execFile("vlc", [file.path]);
  },
  previous() {
    if (!cursor.hasPrevious())
      return;
    
    cursor.previous();
    events.emit("file-changed");
  },
  async reshoot() {
    // TODO: refresh screenshot of current file
    
    events.emit("file-changed");
  }
};

export const ratings = {
  async decrease(fileId) {
    const file = await db.get(fileId || cursor.current.id);
    let {rating} = file;
    if (rating <= -1)
      return;
    
    rating--;
    await db.setRating(file.id, rating);
    cursor.current.rating = rating;
    events.emit("rating-changed");
  },
  async increase(fileId) {
    const file = await db.get(fileId || cursor.current.id);
    let {rating} = file;
    if (rating >= 5)
      return;
    
    rating++;
    await db.setRating(file.id, rating);
    cursor.current.rating = rating;
    events.emit("rating-changed");
  }
};

export async function load(newDb) {
  db = newDb;
  
  const fileIndex = await db.getFileIndex();
  cursor = new FileCursor(fileIndex);
  ranges = await db.getRanges();
  
  events.emit("index-changed");
}
