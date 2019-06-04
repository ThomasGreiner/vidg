export function $(selector) {
  return document.querySelector(selector);
}

HTMLElement.prototype.create = function (tagName) {
  var element = document.createElement(tagName);
  this.appendChild(element);
  return element;
};

var postActions = ["empty-trash", "rate-down", "rate-up", "view", "view-all"];
export function request(action, params = {}) {
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
      var evName = (xhr.status == 200) ? "actionsuccess" : "actionerror";
      var data = xhr.responseText && JSON.parse(xhr.responseText);
      document.dispatchEvent(new CustomEvent(evName, {detail: data}));
    }
  }, false);
  xhr.send(param);
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

document.addEventListener("change", function(ev) {
  let {target} = ev;
  let value = (target.type == "checkbox") ? target.checked : target.value;
  
  request(target.name, {value});
  target.blur();
}, false);
