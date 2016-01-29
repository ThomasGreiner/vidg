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
  document.querySelector("button[data-action='prev']").style.visibility = (file.stats.hasPrev) ? "visible" : "hidden";
  document.querySelector("button[data-action='next']").style.visibility = (file.stats.hasNext) ? "visible": "hidden";
  document.getElementById("status").src = (success) ? file.stats.statusImage : "";
  document.getElementById("name").innerText = (success) ? normalizeFilename(file.name) : "No files";
  document.getElementById("screenshot").src = (success) ? file.image : "";
  document.body.dataset.rating = (success) ? file.rating : "";
}

function normalizeFilename(filename) {
  return filename
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
