let postActions = new Set(["empty-trash", "rate-down", "rate-up", "view",
    "view-all"]);

HTMLElement.prototype.create = function(tagName) {
  var element = document.createElement(tagName);
  this.appendChild(element);
  return element;
};

export function $(selector) {
  return document.querySelector(selector);
}

export async function request(action, params = {}) {
  if (!action)
    return;
  
  let url = `/${action}`;
  let qs = new URLSearchParams();
  for (let name in params) {
    qs.append(name, params[name]);
  }
  
  let resp;
  if (postActions.has(action)) {
    resp = await fetch(url, {
      method: "POST",
      body: qs.toString()
    });
  } else {
    resp = await fetch(`${url}?${qs}`);
  }
  
  let evName = (resp.status === 200) ? "actionsuccess" : "actionerror";
  let data = await resp.json();
  document.dispatchEvent(new CustomEvent(evName, {detail: data}));
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
