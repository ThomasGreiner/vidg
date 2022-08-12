export const $ = (selector) => document.querySelector(selector);

export function formatDate(timestamp) {
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    year: "numeric"
  }).format(timestamp);
}

export function formatTime(seconds) {
  let str = new Intl.DateTimeFormat(undefined, {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
    timeZone: "UTC"
  }).format(seconds * 1000);
  
  // Chromium 80 formats 0 as 24:00:00
  str = str.replace(/^24:/, "00:");
  
  return str;
}

export function formatSize(size) {
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
