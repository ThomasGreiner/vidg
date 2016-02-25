"use strict";

require("colors");

function defineLog(method, color) {
  let orig = console[method];
  console[method] = function() {
    let args = Array.from(arguments);
    orig.apply(this, args.map((arg) => {
      if (typeof arg == "string")
        arg = arg[color];
      return arg;
    }));
  };
}
defineLog("error", "red");
defineLog("info", "cyan");
defineLog("log", "gray");
defineLog("warn", "yellow");

/**
 * Determine differences between two Maps
 * @param {Array|Map} mapA
 * @param {Array|Map} mapB
 * @return {Object} changes
 */
function diffMaps(mapA, mapB) {
  mapA = new Map(mapA);
  mapB = new Map(mapB);
  let result = {
    added: [],
    removed: []
  };
  for (let a of mapA) {
    if (mapB.has(a[0])) {
      mapB.delete(a[0]);
    } else {
      result.removed.push(a[1]);
    }
  }
  for (let b of mapB) {
    result.added.push(b[1]);
  }
  return result;
}
module.exports.diffMaps = diffMaps;
