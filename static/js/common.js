import {api, request} from "./api.js";

export const $ = (selector) => document.querySelector(selector);

export function registerActions(keyMap) {
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
    
    action();
  }, true);
  
  document.addEventListener("click", async (ev) => {
    let {dataset} = ev.target;
    
    if ("rest" in dataset) {
      let [method, endpoint] = dataset.rest.split(":", 2);
      await api[method](endpoint);
      if (method !== "get") {
        await api.get("/file");
      }
    } else if ("action" in dataset) {
      request(dataset.action);
    }
  }, false);
}
