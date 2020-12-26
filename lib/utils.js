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
