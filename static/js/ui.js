import {$} from "./common.js";
import {formatDate, formatSize, formatTime} from "./format.js";

export function setPath(filepath) {
  let fileparts = filepath.split("/");
  
  let path = $("#path");
  path.textContent = "";
  while (fileparts.length > 1) {
    let part = path.create("div");
    part.textContent = fileparts.shift();
  }
  
  $("#name").textContent = fileparts.pop();
}

export function setStats(stats, ranges) {
  let bitrate = $("#bitrate");
  bitrate.dataset.magnitude = Math.round(stats.bitrate / (ranges.bitrate.max - ranges.bitrate.min) * 5, 0);
  bitrate.textContent = `${stats.bitrate} kb/s`;
  
  function setStat(name, format) {
    let range = ranges[name];
    let element = $(`#${name}`);
    element.dataset.magnitude = Math.round(
      (stats[name] - range.min) / (range.max - range.min) * 5,
      0
    );
    element.textContent = format(stats[name]);
  }
  
  setStat("created", formatDate);
  setStat("duration", formatTime);
  setStat("size", formatSize);
  setStat("width", (width) => `w: ${width}px`);
  setStat("height", (height) => `h: ${height}px`);
}
