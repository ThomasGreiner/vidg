import {$} from "./common.js";
import {formatSize} from "./format.js";
import {setPlayer} from "./player.js";
import {setPath, setStats} from "./ui.js";

function onFileData(ev) {
  var {file, ranges, stats} = ev.detail;
  
  let ratings = Object.keys(stats.ratings)
    .sort()
    .map((rating) => `${rating}: ${formatSize(stats.ratings[rating].size)} | ${stats.ratings[rating].count}`)
    .join("\n");
  
  $("#distribution").src = stats.distributionImage;
  $("#distribution").title = ratings;
  $("#status").src = stats.statusImage;
  
  setPath(file.path);
  setPlayer(file.id, file.preview);
  setStats(file.stats, ranges);
  
  document.body.dataset.error = false;
  document.body.dataset.hasPrev = stats.hasPrev;
  document.body.dataset.hasNext = stats.hasNext;
  document.body.dataset.rating = file.rating;
}
document.addEventListener("actionsuccess", onFileData);

function onError(ev) {
  document.body.dataset.error = true;
}
document.addEventListener("actionerror", onError);
