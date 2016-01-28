/* jslint browser: true */

"use strict";

var currentFile = null;

var postActions = ["keep", "trash", "view"];
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
  document.querySelector("button[data-action='prev']").style.visibility = (file.stats.hasPrev) ? "visible" : "hidden";
  document.querySelector("button[data-action='next']").style.visibility = (file.stats.hasNext) ? "visible": "hidden";
  if (success) {
    setProgress("progress", file.stats.progress, file.stats.total);
    setProgress("status", file.stats.keep, file.stats.trash, file.stats.total);
  }
  document.getElementById("name").innerText = (success) ? normalizeFilename(file.name) : "No files";
  document.getElementById("image").src = (success) ? file.image : "";
  document.body.dataset.status = (success) ? file.status : "";
}

function normalizeFilename(filename) {
  return filename
    .replace(/\..*$/, "")
    .replace(/[\-_]/g, " ");
}

function setProgress(id) {
  var values = arguments;
  var total = arguments[arguments.length - 1];
  var bars = document.querySelectorAll("#" + id + " > .progress-bar");
  for (var i = 0; i < bars.length; i++) {
    bars[i].style.width = (values[i + 1] / total * 100) + "%";
  }
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
  Down: "trash",
  Enter: "view",
  Left: "prev",
  Right: "next",
  Up: "keep"
};
function onKeyPress(ev) {
  var action = keymap[ev.keyIdentifier];
  if (action)
    onAction(action);
}

function onLoad() {
  document.body.addEventListener("click", onClick, true);
  window.addEventListener("keyup", onKeyPress, true);
  request("first", null, onFileData);
}
document.addEventListener("DOMContentLoaded", onLoad, false);
