/* jslint browser: true */

"use strict";

function $(selector) {
  return document.querySelector(selector);
}

function $$(selector) {
  return document.querySelectorAll(selector);
}

HTMLElement.prototype.create = function (tagName) {
  var element = document.createElement(tagName);
  this.appendChild(element);
  return element;
};

var postActions = ["empty-trash", "rate-down", "rate-up", "view"];
function request(action, params, callback) {
  if (!action)
    return;
  
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

function registerActions(startAction, keyMap, onData) {
  window.addEventListener("keyup", function(ev) {
    var key = ev.keyIdentifier;
    if (ev.ctrlKey) {
      key = `CTRL+${key}`;
    }
    
    request(keyMap[key], {}, onData);
  }, true);
  
  document.addEventListener("click", function(ev) {
    request(ev.target.dataset.action, {}, onData);
  }, false);
  
  request(startAction, {}, onData);
}
