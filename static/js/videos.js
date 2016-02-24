/* jslint browser: true */

"use strict";

var currentFile = null;

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
      callback(xhr.status, JSON.parse(xhr.responseText));
    }
  }, false);
  xhr.send(param);
}

function onFileData(status, file) {
  var success = (status == 200);
  currentFile = (success) ? file : null;
  document.getElementById("status").src = (success) ? file.stats.statusImage : "";
  document.getElementById("name").innerText = (success) ? normalizeFilepath(file.path) : "No files";
  document.getElementById("preview").src = (success) ? file.preview : "";
  document.body.dataset.hasPrev = (success) ? file.stats.hasPrev : false;
  document.body.dataset.hasNext = (success) ? file.stats.hasNext : false;
  document.body.dataset.rating = (success) ? file.rating : "";
}

function normalizeFilepath(filepath) {
  return filepath
    .replace(/^.*\//, "")
    .replace(/\..*$/, "")
    .replace(/[\-_]/g, " ");
}

function onAction(action) {
  request(action, {}, onFileData);
}

function onClick(ev) {
  var action = ev.target.dataset.action;
  if (action)
    onAction(action);
}

var keymap = {
  Down: "rate-down",
  Enter: "view",
  Left: "prev",
  Right: "next",
  Up: "rate-up"
};
function onKeyPress(ev) {
  var action = keymap[ev.keyIdentifier];
  if (action)
    onAction(action);
}

function onLoad() {
  document.body.addEventListener("click", onClick, true);
  window.addEventListener("keyup", onKeyPress, true);
  request("current", {}, onFileData);
}
document.addEventListener("DOMContentLoaded", onLoad, false);
