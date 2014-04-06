var child = require("child_process");
var fs = require("fs");
var path = require("path");

var utils = require("./utils");

var queue;
var total;
var inputDir;
var shotsDir;
var onEnd;

module.exports = function(input, callback) {
  input = path.resolve(input);
  
  onEnd = callback;
  queue = [];
  inputDir = fs.realpathSync(input);
  shotsDir = utils.mkdirpSync(input + ".shots");
  
  var files = fs.readdirSync(inputDir);
  files.forEach(function(file) {
    if (!fs.existsSync(path.join(shotsDir, file + ".jpg")) && path.extname(file) != ".webm")
      queue.push(file);
  });
  total = queue.length;
  
  createShot();
}

function createShot() {
  if (queue.length == 0) {
    console.log("Done".green);
    onEnd();
    return;
  }
  
  var file = queue.shift();
  console.log("Processing %s", file);
  
  var cmd = utils.createShellCommand({
    name: "cd",
    tail: [inputDir]
  },
  {
    name: path.join(__dirname, "shot"),
    params: {n: "9", r: "40%"},
    tail: [path.join(inputDir, file)]
  }, {
    name: "mv",
    tail: [
      path.join(inputDir, file.replace(/\.[^.]+$/, ".jpg")),
      path.join(shotsDir, file + ".jpg")
    ]
  });
  
  childProcess = child.exec(cmd, function(err) {
    // kill = false;
    if (err)
      console.log(err.message.red);
    console.log("%s %s/%s (%s\%)"[err ? "red" : "green"], err ? "Error" : "Done", total - queue.length, total, ((total - queue.length) / total * 100) >> 0);
    setTimeout(createShot, 0);
  });
}
