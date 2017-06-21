/* jslint browser: true */
/* global $, registerActions, request */

"use strict";

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
  var file = ev.detail;
  var fileparts = file.path.split("/");
  var path = $("#path");
  path.textContent = "";
  while (fileparts.length > 1) {
    var part = path.create("button");
    part.textContent = fileparts.shift();
  }
  
  let ratingSizes = Object.keys(file.stats.ratingSizes)
    .sort()
    .map((rating) => `${rating}: ${formatSize(file.stats.ratingSizes[rating])}`)
    .join("\n");
  
  $("#distribution").src = file.stats.distributionImage;
  $("#distribution").title = ratingSizes;
  $("#name").textContent = fileparts.pop();
  $("#size").textContent = formatSize(file.size);
  $("#preview").src = file.preview;
  $("#status").src = file.stats.statusImage;
  document.body.dataset.error = false;
  document.body.dataset.hasPrev = file.stats.hasPrev;
  document.body.dataset.hasNext = file.stats.hasNext;
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
