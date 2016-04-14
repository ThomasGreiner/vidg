/* jslint browser: true */

"use strict";

var postActions = ["rate-up", "rate-down", "view"];
function request(action, params, callback) {
  var method = (postActions.indexOf(action) > -1) ? "POST" : "GET";
  var url = "/" + action;
  var param = [];
  for (var i in params) {
    param.push(i + "=" + encodeURIComponent(params[i]));
  }
  param = param.join("&");
  
  if (method == "GET") {
    url += "?" + param;
    param = null;
  }
  
  var xhr = new XMLHttpRequest();
  xhr.open(method, url, true);
  xhr.addEventListener("readystatechange", function(ev) {
    if (xhr.readyState == 4) {
      callback(xhr.status, xhr.responseText && JSON.parse(xhr.responseText));
    }
  }, false);
  xhr.send(param);
}

function onFileData(status, file) {
  if (status != 200)
    return;
  
  var fileparts = file.path.split("/").slice(1);
  var path = document.getElementById("path");
  path.textContent = "";
  while (fileparts.length > 1) {
    var part = document.createElement("button");
    part.textContent = fileparts.shift();
    path.appendChild(part);
  }
  
  document.getElementById("distribution").src = file.stats.distributionImage;
  document.getElementById("name").textContent = fileparts.pop();
  document.getElementById("preview").src = file.preview;
  document.getElementById("status").src = file.stats.statusImage;
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
