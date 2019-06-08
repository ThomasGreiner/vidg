import {api, request} from "./api.js";
import {$} from "./common.js";
import {setPlayer} from "./player.js";
import {setCharts, setPath, setStats} from "./ui.js";

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

function onError(ev) {
  document.body.dataset.error = true;
}
document.addEventListener("actionerror", onError);

function onFileData(ev) {
  let {charts, file, ranges, ratings, status} = ev.detail;
  
  setCharts(charts, ratings);
  setPath(file.path);
  setPlayer(file.id, file.preview);
  setStats(file.stats, ranges);
  
  document.body.dataset.error = false;
  document.body.dataset.hasPrev = status.hasPrev;
  document.body.dataset.hasNext = status.hasNext;
  document.body.dataset.rating = file.rating;
}
document.addEventListener("actionsuccess", onFileData);

api.get("/file");
