/* jslint browser: true */
/* global $, registerActions, request */

"use strict";

var sizePostfix = ["B", "KB", "MB", "GB", "TB"];

function formatSize(bytes) {
  var str = bytes;
  for (var i = 0; i < sizePostfix.length; i++) {
    str = ((bytes * 100 >> 0) / 100) + sizePostfix[i];
    bytes /= 1000;
    if (Math.abs(bytes) < 1)
      break;
  }
  return str;
}

function formatSimilarity(percent) {
  return (percent * 1000 >> 0) / 10;
}

function renderFile(id, a, b) {
  var eFile = $("#" + id);
  eFile.classList.add("file");
  eFile.innerHTML = "";
  
  var ePreview = eFile.create("img");
  ePreview.classList.add("preview");
  ePreview.src = a.preview;
  
  var eMeta = eFile.create("div");
  eMeta.classList.add("meta");
  
  var eTitle = eMeta.create("strong");
  eTitle.textContent = a.path;
  
  var eSize = eMeta.create("div");
  eSize.classList.add("size");
  eSize.classList.toggle("positive", a.stats.size > b.stats.size);
  eSize.classList.toggle("negative", a.stats.size < b.stats.size);
  eSize.textContent = formatSize(a.stats.size);
}

function renderComparison(status, comparison) {
  var eSimilar = $("#similarity");
  eSimilar.querySelector(".total").textContent = formatSimilarity(comparison.factors.size);
  eSimilar.querySelector(".size").textContent = formatSimilarity(comparison.factors.size);
  
  renderFile("file-a", comparison.a, comparison.b);
  renderFile("file-b", comparison.b, comparison.a);
  
  $("#distribution").src = comparison.stats.distributionImage;
  $("#status").src = comparison.stats.statusImage;
  document.body.dataset.hasPrev = comparison.stats.hasPrev;
  document.body.dataset.hasNext = comparison.stats.hasNext;
}

registerActions("compare/current", {
  "Left": "compare/prev",
  "Right": "compare/next"
}, renderComparison);
