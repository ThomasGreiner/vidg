/* jslint browser: true */

"use strict";

function onFileData(status, file) {
  if (status != 200)
    return;
  
  var fileparts = file.path.split("/").slice(1);
  var path = $("#path");
  path.textContent = "";
  while (fileparts.length > 1) {
    var part = path.create("button");
    part.textContent = fileparts.shift();
  }
  
  $("#distribution").src = file.stats.distributionImage;
  $("#name").textContent = fileparts.pop();
  $("#preview").src = file.preview;
  $("#status").src = file.stats.statusImage;
  document.body.dataset.hasPrev = file.stats.hasPrev;
  document.body.dataset.hasNext = file.stats.hasNext;
  document.body.dataset.rating = file.rating;
}

function onAction(action) {
  if (!action)
    return;
  
  request(action, {}, onFileData);
}

function onClick(ev) {
  onAction(ev.target.dataset.action);
}

var keymap = {
  "Down": "rate-down",
  "Enter": "view",
  "Left": "prev",
  "Right": "next",
  "Up": "rate-up",
  "CTRL+Right": "next-unrated"
};
function onKeyPress(ev) {
  var key = ev.keyIdentifier;
  if (ev.ctrlKey) {
    key = `CTRL+${key}`;
  }
  onAction(keymap[key]);
}

function onLoad() {
  document.body.addEventListener("click", onClick, true);
  window.addEventListener("keyup", onKeyPress, true);
  request("current", {}, onFileData);
}
document.addEventListener("DOMContentLoaded", onLoad, false);
