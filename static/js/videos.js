import {$} from "./common.js";
import {formatSize} from "./format.js";
import {setPlayer} from "./player.js";
import {setPath, setStats} from "./ui.js";

function onFileData(ev) {
  var {file, ranges, status} = ev.detail;
  
  let ratings = Object.keys(status.ratings)
    .sort()
    .map((rating) => `${rating}: ${formatSize(status.ratings[rating].size)} | ${status.ratings[rating].count}`)
    .join("\n");
  
  $("#distribution").src = status.distributionImage;
  $("#distribution").title = ratings;
  $("#status").src = status.statusImage;
  
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
