var fs = require("fs");
var path = require("path");

var trashDir = fs.realpathSync("trash");

module.exports = handleRequest;
function handleRequest(params, callback) {
  switch (params.action) {
    case "remove":
      moveFile(params.name, trashDir, callback)
      break;
    default:
      callback({/*...*/});
  }
}

/**
 * Moves specified file to target directory
 * @param {string} fileName file name  
 * @param {string} targetDir target directory
 * @param {Function} callback callback function
 */
function moveFile(fileName, targetDir, callback) {
  fs.rename(path.join(global.vidDir, fileName), path.join(targetDir, fileName), function() {
    callback({/*...*/});
  });
}
