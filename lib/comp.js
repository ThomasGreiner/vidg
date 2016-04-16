"use strict";

const MAX_SIZE_DIFF = 0; // 0%

function compareNumber(key, threshold, files) {
  files = files.slice().sort((a, b) => a.stats[key] - b.stats[key]);
  
  let result = new Set();
  for (let i = 0; i < files.length; i++) {
    let a = files[i];
    
    for (let j = i + 1; j < files.length; j++) {
      let b = files[j];
      let diff = b.stats[key] - a.stats[key];
      if (diff > threshold * b.stats[key])
        break;
      
      result.add([a, b, 1 - (diff / (threshold * b.stats[key])) || 1]);
    }
  }
  return result;
}

function merge(key, comparisons, similarities) {
  for (let similarity of similarities) {
    let a = similarity[0];
    let b = similarity[1];
    let value = similarity[2];
    
    if (a.id > b.id) {
      let tmp = a;
      a = b;
      b = tmp;
    }
    
    let comparison = comparisons.get(a.id);
    if (comparison) {
      comparison.factors.set(key, value);
    } else {
      comparisons.set(a.id, {
        a, b,
        factors: new Map([["size", value]])
      });
    }
  }
}

module.exports.process = function(files) {
  let comparisons = new Map();
  
  let similarSize = compareNumber("size", MAX_SIZE_DIFF, files);
  merge("size", comparisons, similarSize);
  
  comparisons = Array.from(comparisons.values());
  return comparisons.sort((a, b) => a.a.id - b.a.id);
};
