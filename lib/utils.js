"use strict";

require("colors");

function defineLog(method, color) {
  let orig = console[method];
  console[method] = function() {
    let args = Array.from(arguments);
    orig.apply(this, args.map((arg) => {
      if (typeof arg == "string") {
        if (/^\[.*\]$/.test(arg)) {
          arg = arg.slice(1, -1).cyan;
        } else {
          arg = arg[color];
        }
      }
      return arg;
    }));
  };
}
defineLog("error", "red");
defineLog("info", "cyan");
defineLog("log", "gray");
defineLog("warn", "yellow");

/**
 * Determine differences between two lists
 * @param {string} key - property to use for comparing objects
 * @param {Array<Object>} listA
 * @param {Array<Object>} listB
 * @param {Array<string>} [props] - list of property names to compare
 * @return {Object} changes
 */
function diff(key, listA, listB, props) {
  let mapA = new Map(listA.map((obj) => [obj[key], obj]));
  let mapB = new Map(listB.map((obj) => [obj[key], obj]));
  let result = {
    added: [],
    changed: {},
    removed: [],
    unchanged: []
  };
  
  if (props) {
    for (let prop of props) {
      result.changed[prop] = [];
    }
  }
  
  for (let a of mapA) {
    let key = a[0];
    let value = a[1];
    
    if (mapB.has(key)) {
      let hasChange = false;
      if (props) {
        let b = mapB.get(key);
        for (let prop of props) {
          if (value[prop] != b[prop]) {
            result.changed[prop].push(b);
            hasChange = true;
          }
        }
      }
      if (!hasChange) {
        result.unchanged.push(value);
      }
      mapB.delete(key);
    } else {
      result.removed.push(value);
    }
  }
  for (let b of mapB) {
    result.added.push(b[1]);
  }
  return result;
}
module.exports.diff = diff;
