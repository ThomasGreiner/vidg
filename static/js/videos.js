import {api, request} from "./api.js";
import {$} from "./common.js";
import {setPlayer} from "./player.js";
import {setCharts, setPath, setStats} from "./ui.js";

function onChange(ev) {
  let {target} = ev;
  let value = (target.type == "checkbox") ? target.checked : target.value;
  
  request(target.name, {value});
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
