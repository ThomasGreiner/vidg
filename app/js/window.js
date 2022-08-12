import * as settings from "./storage/settings.js";

const win = nw.Window.get();

win.on("move", (x, y) => {
  settings.set("position", {x, y});
});

win.on("maximize", () => {
  settings.set("state", "maximized");
});

win.on("resize", (width, height) => {
  settings.set("size", {width, height});
});

win.on("restore", () => {
  settings.set("state", null);
});

const initialPosition = await settings.get("position");
if (initialPosition) {
  win.moveTo(initialPosition.x, initialPosition.y);
}

const state = await settings.get("state");
if (state === "maximized") {
  win.maximize();
} else {
  const initialSize = await settings.get("size");
  if (initialSize) {
    win.resizeTo(initialSize.width, initialSize.height);
  }
}
