var fs = require("fs");

module.exports.mkdirpSync = mkdirpSync;
function mkdirpSync(dir) {
  var exists = fs.existsSync(dir);
  if (!exists)
    fs.mkdirSync(dir);
  return fs.realpathSync(dir);
}

function escapeShell(str) {
  return str.replace(/([\s\(\)])/g, "\\$1");
}

module.exports.createShellCommand = createShellCommand;
function createShellCommand() {
  return Array.prototype.map.call(arguments, function(cmd) {
    var params = cmd.params;
    var paramStr = "";
    for (var i in params) {
      paramStr += " -" + i;
      if (params[i])
        paramStr += " " + escapeShell(params[i]);
    }
    if (cmd.tail)
      paramStr += " " + cmd.tail.map(escapeShell).join(" ");
    return cmd.name + paramStr + ";"
  }).join("");
}
