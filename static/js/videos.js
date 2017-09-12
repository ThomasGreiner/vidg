/* jslint browser: true */
/* global $, registerActions, request */

"use strict";

function formatDate(timestamp) {
  let date = new Date(timestamp);
  return date.toDateString();
}

function formatTime(seconds) {
  return new Intl.DateTimeFormat(undefined, {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
    timeZone: "UTC"
  }).format(seconds * 1000);
}

function formatSize(size) {
  if (size < 1024)
    return `${size} B`;
  
  size /= 1024;
  if (size < 1024)
    return `${size.toFixed(size < 10 ? 1 : 0)} KB`;
  
  size /= 1024;
  if (size < 1024)
    return `${size.toFixed(size < 10 ? 1 : 0)} MB`;
  
  size /= 1024;
  return `${size.toFixed(size < 10 ? 1 : 0)} GB`;
}

function onFileData(ev) {
  var {file, stats} = ev.detail;
  var fileparts = file.path.split("/");
  var path = $("#path");
  path.textContent = "";
  while (fileparts.length > 1) {
    var part = path.create("button");
    part.textContent = fileparts.shift();
  }
  
  let ratings = Object.keys(stats.ratings)
    .sort()
    .map((rating) => `${rating}: ${formatSize(stats.ratings[rating].size)} | ${stats.ratings[rating].count}`)
    .join("\n");
  
  $("#bitrate").textContent = `${file.stats.bitrate} kb/s`;
  $("#created").textContent = formatDate(file.stats.created);
  $("#distribution").src = stats.distributionImage;
  $("#distribution").title = ratings;
  $("#duration").textContent = formatTime(file.stats.duration);
  $("#name").textContent = fileparts.pop();
  $("#size").textContent = formatSize(file.stats.size);
  $("#preview").src = file.preview;
  $("#status").src = stats.statusImage;
  document.body.dataset.error = false;
  document.body.dataset.hasPrev = stats.hasPrev;
  document.body.dataset.hasNext = stats.hasNext;
  document.body.dataset.rating = file.rating;
}
document.addEventListener("actionsuccess", onFileData);

function onError(ev) {
  document.body.dataset.error = true;
}
document.addEventListener("actionerror", onError);

registerActions("current", {
  "ArrowDown": "rate-down",
  "Enter": "view",
  "ArrowLeft": "prev",
  "ArrowRight": "next",
  "ArrowUp": "rate-up",
  "CTRL+ArrowLeft": "prev-unrated",
  "CTRL+ArrowRight": "next-unrated"
});
