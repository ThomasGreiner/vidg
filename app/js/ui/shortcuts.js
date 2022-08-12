const callbackById = new Map();
const callbackByKeys = new Map();

export function setShortcut(id, keys, fn) {
  if (id !== null) {
    callbackById.set(id, fn);
  }
  if (keys !== null) {
    callbackByKeys.set(keys, fn);
  }
}

function onClick(ev) {
  const {dataset} = ev.target;
  
  if (!("action" in dataset))
    return;
  
  const callback = callbackById.get(dataset.action);
  if (!callback)
    return;
  
  callback();
}
document.addEventListener("click", onClick);

function onKey(ev) {
  let keys = ev.key;
  if (ev.shiftKey) {
    keys = `SHIFT+${keys}`;
  }
  if (ev.ctrlKey) {
    keys = `CTRL+${keys}`;
  }
  
  const callback = callbackByKeys.get(keys);
  if (!callback)
    return;
  
  callback();
}
window.addEventListener("keyup", onKey);
