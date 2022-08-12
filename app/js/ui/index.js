const gui = require("nw.gui");

import * as api from "../storage/api.js";
import syncEvents from "../sync/events.js";
import {setPlayer} from "./player.js";
import {setShortcut} from "./shortcuts.js";
import {$, formatDate, formatSize, formatTime} from "./utils.js";

const filters = {};
const syncStats = {
  processed: 0,
  total: 0
};

export async function load(db) {
  await api.load(db);
}

function setCharts(charts, ratings) {
  let ratingsTooltip = Object.keys(ratings)
    .sort()
    .map((rating) => `${rating}: ${formatSize(ratings[rating].size)} | ${ratings[rating].count}`)
    .join("\n");
  
  $("#chart-distribution").src = charts.distribution;
  $("#chart-distribution").title = ratingsTooltip;
  $("#chart-status").src = charts.status;
}

export async function resetFileData(keepPlayer = false) {
  const charts = await api.index.getCharts();
  const file = await api.files.get();
  const ranges = await api.index.getRanges();
  const ratings = await api.index.getRatings();
  
  setCharts(charts, ratings);
  setPath(file.path.relative);
  if (!keepPlayer) {
    setPlayer(file.id, file.preview);
  }
  setStats(file.stats, ranges);
  
  document.body.dataset.error = false;
  document.body.dataset.rating = file.rating;
}

function setPath(filepath) {
  let fileparts = filepath.split("/");
  
  let path = $("#path");
  path.textContent = "";
  while (fileparts.length > 1) {
    let part = document.createElement("div");
    part.textContent = fileparts.shift();
    path.appendChild(part);
  }
  
  $("#name").textContent = fileparts.pop();
}

function setStats(stats, ranges) {
  function setStat(name, format) {
    let range = ranges[name];
    let element = $(`#${name}`);
    
    const magnitude = (stats[name] - range.min) / (range.max - range.min);
    element.style.setProperty("--magnitude", `${magnitude * 100}%`);
    element.dataset.magnitude = Math.round(
      (stats[name] - range.min) / (range.max - range.min) * 5,
      0
    );
    element.textContent = format(stats[name]);
  }
  
  setStat("bitrate", (bitrate) => `${bitrate} kb/s`);
  setStat("created", formatDate);
  setStat("duration", formatTime);
  setStat("size", formatSize);
  setStat("width", (width) => `w: ${width}px`);
  setStat("height", (height) => `h: ${height}px`);
}

// TODO: NYI
// function onFileError(ev) {
//   document.body.dataset.error = true;
// }
// document.addEventListener("fileerror", onFileError);

async function onChange(ev) {
  const {target} = ev;
  const {name} = target;
  let value = (target.type == "checkbox") ? target.checked : target.value;
  
  if (name === "sort") {
    const [key, dir] = value.split("-", 2);
    api.index.sort(key, dir);
  } else {
    const [type, key] = name.split("-", 2);
    if (type !== "filter")
      return;
    
    if (!value || value === "any") {
      delete filters[key];
      if (!Object.keys(filters).length) {
        filters = {};
      }
    } else {
      if (key === "rating") {
        value = parseInt(value, 10);
      }
      filters[key] = value;
    }
    await api.index.applyFilters(filters);
  }
  
  target.blur();
}
document.addEventListener("change", onChange);

function log(type, str) {
  const item = document.createElement("div");
  item.classList.add(`type-${type}`);
  item.textContent = str;
  $("#log").prepend(item);
}

api.events.on("file-changed", async () => {
  await resetFileData();
});
api.events.on("index-changed", async () => {
  await resetFileData();
});
api.events.on("rating-changed", async () => {
  await resetFileData(true);
});

syncEvents.on("start", () => {
  log("info", "Starting sync");
  document.body.classList.add("syncing");
});
syncEvents.on("found", (data) => {
  $("#sync-found").textContent = `${data} found`;
});
syncEvents.on("changes", (changes) => {
  $("#sync-new").textContent = `${changes.added} added`;
  $("#sync-missing").textContent = `${changes.removed} missing`;
  $("#sync-renamed").textContent = `${changes.moved} renamed`;
  
  syncStats.total = changes.added;
});
syncEvents.on("process", (filepath) => {
  log("info", `[${syncStats.processed + 1}/${syncStats.total}] ${filepath}`);
  syncStats.processed++;
});
syncEvents.on("end", () => {
  log("success", "Finished sync");
  document.body.classList.remove("syncing");
});
syncEvents.on("error", (err) => {
  log("error", `Sync failed: ${err}`);
});

setShortcut("rating.down", "ArrowDown", async () => {
  await api.ratings.decrease();
});
setShortcut("rating.up", "ArrowUp", async () => {
  await api.ratings.increase();
});
setShortcut("reshoot", null, async () => {
  await api.files.reshoot();
});
setShortcut("trash", null, async () => {
  await api.index.emptyTrash();
});
setShortcut(null, "CTRL+SHIFT+Enter", async () => {
  const file = await api.files.get();
  gui.Shell.showItemInFolder(file.path.absolute);
});
