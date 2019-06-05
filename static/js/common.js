import {request} from "./api.js";

export function $(selector) {
  return document.querySelector(selector);
}

export function registerActions(startAction, keyMap) {
  window.addEventListener("keyup", function(ev) {
    var key = ev.key;
    if (ev.ctrlKey) {
      key = `CTRL+${key}`;
    }
    if (ev.shiftKey) {
      key = `SHIFT+${key}`;
    }
    
    let action = keyMap[key];
    if (!action)
      return;
    
    switch (typeof action) {
      case "function":
        action();
        break;
      case "string":
        request(action);
        break;
    }
  }, true);
  
  document.addEventListener("click", function(ev) {
    request(ev.target.dataset.action);
  }, false);
  
  request(startAction);
}
