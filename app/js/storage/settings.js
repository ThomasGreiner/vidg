export async function get(key) {
  return new Promise((resolve) => {
    chrome.storage.local.get(key, (storage) => {
      resolve(storage[key]);
    });
  });
}

export async function set(key, value) {
  return new Promise((resolve) => {
    chrome.storage.local.set({[key]: value}, resolve);
  });
}
