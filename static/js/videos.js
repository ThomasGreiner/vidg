/* jslint browser: true */
/* global $, registerKeys, request */

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

function onClick(ev) {
  var action = ev.target.dataset.action;
  if (!action)
    return;
  
  request(action, {}, onFileData);
}

registerKeys({
  "Down": "rate-down",
  "Enter": "view",
  "Left": "prev",
  "Right": "next",
  "Up": "rate-up",
  "CTRL+Right": "next-unrated"
}, onFileData);

function onLoad() {
  document.body.addEventListener("click", onClick, true);
  request("current", {}, onFileData);
}
document.addEventListener("DOMContentLoaded", onLoad, false);
