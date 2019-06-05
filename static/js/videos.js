import {$} from "./common.js";
import {formatSize} from "./format.js";
import {setPlayer} from "./player.js";
import {setPath, setStats} from "./ui.js";

function onFileData(ev) {
  let {charts, file, ranges, ratings, status} = ev.detail;
  
  let ratingsTooltip = Object.keys(ratings)
    .sort()
    .map((rating) => `${rating}: ${formatSize(ratings[rating].size)} | ${ratings[rating].count}`)
    .join("\n");
  
  $("#chart-distribution").src = charts.distribution;
  $("#chart-distribution").title = ratingsTooltip;
  $("#chart-status").src = charts.status;
  
  setPath(file.path);
  setPlayer(file.id, file.preview);
  setStats(file.stats, ranges);
  
  document.body.dataset.error = false;
  document.body.dataset.hasPrev = status.hasPrev;
  document.body.dataset.hasNext = status.hasNext;
  document.body.dataset.rating = file.rating;
}
document.addEventListener("actionsuccess", onFileData);

function onError(ev) {
  document.body.dataset.error = true;
}
document.addEventListener("actionerror", onError);
