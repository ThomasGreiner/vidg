import api from "./api.js";
import {$} from "./common.js";
import {keyMap, setPlayer} from "./player.js";
import {setCharts, setColors, setPath, setStats} from "./ui.js";

let listParams = {};

async function onChange(ev) {
  let {target} = ev;
  let {name} = target;
  let value = (target.type == "checkbox") ? target.checked : target.value;
  
  if (name === "sort") {
    delete listParams.sort;
    
    let [key, dir] = value.split("-", 2);
    listParams.sort = {key, dir};
  } else {
    let [type, key] = name.split("-", 2);
    if (!(type in listParams)) {
      listParams[type] = {};
    }
    
    if (!value || value === "any") {
      delete listParams[type][key];
      if (!Object.keys(listParams[type]).length) {
        delete listParams[type];
      }
    } else {
      if (key === "rating") {
        value = parseInt(value, 10);
      }
      listParams[type][key] = value;
    }
  }
  
  await api.put("/list", listParams);
  await api.get("/file");
  target.blur();
}
document.addEventListener("change", onChange);

async function onClick(ev) {
  let {dataset} = ev.target;
  
  if ("rest" in dataset) {
    let [method, endpoint] = dataset.rest.split(":", 2);
    await api[method](endpoint);
    if (method !== "get") {
      await api.get("/file");
    }
  }
}
document.addEventListener("click", onClick);

function onFileData(ev) {
  let {charts, file, ranges, ratings, status} = ev.detail;
  
  setCharts(charts, ratings);
  setColors(file.stats.colors);
  setPath(file.path);
  setPlayer(file.id, file.preview);
  setStats(file.stats, ranges);
  
  document.body.dataset.error = false;
  document.body.dataset.hasPrev = status.hasPrev;
  document.body.dataset.hasNext = status.hasNext;
  document.body.dataset.rating = file.rating;
}
document.addEventListener("filedata", onFileData);

function onFileError(ev) {
  document.body.dataset.error = true;
}
document.addEventListener("fileerror", onFileError);

function onKey(ev) {
  let {key} = ev;
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
}
window.addEventListener("keyup", onKey);

api.get("/file");
