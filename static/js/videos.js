/* jslint browser: true */
/* global $, registerActions, request */

"use strict";

function formatDate(timestamp) {
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    year: "numeric"
  }).format(timestamp);
}

function formatTime(seconds) {
  return new Intl.DateTimeFormat(undefined, {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
    timeZone: "UTC"
  }).format(seconds * 1000);
}

function formatSize(size) {
  if (size < 1024)
    return `${size} B`;
  
  size /= 1024;
  if (size < 1024)
    return `${size.toFixed(size < 10 ? 1 : 0)} KB`;
  
  size /= 1024;
  if (size < 1024)
    return `${size.toFixed(size < 10 ? 1 : 0)} MB`;
  
  size /= 1024;
  return `${size.toFixed(size < 10 ? 1 : 0)} GB`;
}

function onFileData(ev) {
  var {file, ranges, stats} = ev.detail;
  var fileparts = file.path.split("/");
  var path = $("#path");
  path.textContent = "";
  while (fileparts.length > 1) {
    var part = path.create("div");
    part.textContent = fileparts.shift();
  }
  
  let ratings = Object.keys(stats.ratings)
    .sort()
    .map((rating) => `${rating}: ${formatSize(stats.ratings[rating].size)} | ${stats.ratings[rating].count}`)
    .join("\n");
  
  let bitrate = $("#bitrate");
  bitrate.dataset.magnitude = Math.round(file.stats.bitrate / (ranges.bitrate.max - ranges.bitrate.min) * 5, 0);
  bitrate.textContent = `${file.stats.bitrate} kb/s`;
  
  $("#distribution").src = stats.distributionImage;
  $("#distribution").title = ratings;
  $("#name").textContent = fileparts.pop();
  $("#status").src = stats.statusImage;
  
  let player = $("#player");
  player.poster = file.preview;
  player.src = `/video?id=${file.id}`;
  
  function setStat(name, format) {
    let range = ranges[name];
    let element = $(`#${name}`);
    element.dataset.magnitude = Math.round(
      (file.stats[name] - range.min) / (range.max - range.min) * 5,
      0
    );
    element.textContent = format(file.stats[name]);
  }
  
  setStat("created", formatDate);
  setStat("duration", formatTime);
  setStat("size", formatSize);
  
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

let player = $("#player");

player.addEventListener("ended", () => {
  document.webkitExitFullscreen();
  location.reload();
});

player.addEventListener("error", () => {
  document.webkitExitFullscreen();
});

registerActions("current", {
  "ArrowDown": "rate-down",
  "Enter": () => {
    if (player.paused) {
      player.webkitRequestFullscreen();
      player.play();
    } else {
      document.webkitExitFullscreen();
      request("current");
    }
  },
  "ArrowLeft": () => {
    if (player.paused) {
      request("prev");
    } else {
      player.currentTime -= 60;
    }
  },
  "ArrowRight": () => {
    if (player.paused) {
      request("next");
    } else {
      player.currentTime += 60;
    }
  },
  "ArrowUp": () => request("rate-up"),
  " ": () => {
    if (player.paused) {
      player.play();
    } else {
      player.pause();
    }
  },
  "CTRL+ArrowLeft": () => {
    if (player.paused) {
      request("prev-unrated");
    } else {
      player.currentTime -= 10;
    }
  },
  "CTRL+ArrowRight": () => {
    if (player.paused) {
      request("next-unrated");
    } else {
      player.currentTime += 10;
    }
  },
  "CTRL+Enter": "view",
  "SHIFT+ArrowLeft": () => {
    if (!player.paused) {
      player.currentTime -= 3;
    }
  },
  "SHIFT+ArrowRight": () => {
    if (!player.paused) {
      player.currentTime += 3;
    }
  }
});
