var http = require("http");
var fs = require("fs");
var url = require("url");
var qs = require("querystring");
var path = require("path");
var open = require("open");

var utils = require("./utils");

var rootPath = path.dirname(require.main.filename);

var types = {
  _binary: ["woff"],
  css: "text/css",
  js: "application/javascript",
  ttf: "font/opentype",
  woff: "font/woff"
};

function onRequest(req, resp) {
  var urlInfo = url.parse(req.url);
  var method = req.method;
  var urlpath = urlInfo.pathname;
  
  switch (method) {
    case "GET":
      var params = qs.parse(urlInfo.query);
      switch (urlpath) {
        case "/":
          // startpage
          fs.readFile(path.resolve(rootPath, "static/videos.htm"), "utf-8", function(err, content) {
            if (!err) {
              resp.writeHead(200, {
                "Content-Type": "text/html"
              });
              resp.write(content);
            }
            resp.end();
          });
          return;
        case "/image":
          // images
          fs.readFile(path.join(File.SHOTS, params.file + ".jpg"), function(err, content) {
            if (!err) {
              resp.writeHead(200, {
                "Content-Type": "image/jpg"
              });
              resp.write(content);
            }
            resp.end();
          });
          return;
        case "/first":
        case "/next":
        case "/prev":
          // video data
          var file;
          if (urlpath == "/first")
            file = File.getFirst();
          else if (urlpath == "/next")
            file = File.getNext();
          else
            file = File.getPrev();
          
          var status = (file) ? 200 : 204;
          if (File.stats.total == 0)
            status = 404;
          resp.writeHead(status, {
            "Content-Type": "text/html"
          });
          if (status == 200) {
            resp.write(JSON.stringify({
              image: "/image?file=" + encodeURIComponent(file.name),
              name: file.name,
              stats: File.stats,
              tag: File.getTag(file)
            }));
          }
          resp.end();
          return;
        default:
          // static resources
          if (urlpath.indexOf("/static/") == 0) {
            var absPath = path.resolve(rootPath, path.relative("/", urlpath));
            var ext = path.extname(absPath).substr(1);
            var isBinary = (types._binary.indexOf(ext) > -1);
            fs.readFile(absPath, isBinary ? "utf-8" : null, function(err, content) {
              if (ext in types) {
                resp.writeHead(200, {
                  "Content-Type": types[ext]
                });
              }
              resp.write(content);
              resp.end();
            });
          } else {
            resp.end();
          }
          return;
      }
      break;
    case "POST":
      // video data
      var params = "";
      req.on("data", function(data) {
        params += data.toString();
      });
      req.on("end", function() {
        params = qs.parse(params);
        
        var file = File.fromName(params.file);
        var targetDir;
        switch (urlpath) {
          case "/keep":
            targetDir = File.KEEP;
            break;
          case "/trash":
            targetDir = File.TRASH;
            break;
          case "/view":
            open(path.join(file.dir, file.name));
            break;
        }
        
        if (!targetDir) {
          resp.writeHead(204);
          resp.end();
          return;
        }
        
        fs.rename(path.join(file.dir, file.name), path.join(targetDir, file.name), function(err) {
          if (err) {
            resp.writeHead(204);
            resp.end();
          } else {
            file.dir = targetDir;
            resp.writeHead(200);
            
            resp.write(JSON.stringify({
              image: "/image?file=" + encodeURIComponent(file.name),
              name: file.name,
              stats: File.stats,
              tag: File.getTag(file)
            }));
            resp.end();
            fs.readdir(File.INPUT, function(err, files) {
              if (!err && files.length == 0) {
                fs.rmdir(File.SHOTS, function() {});
              }
            });
          }
        });
      });
      break;
  }
}

var File = {
  _files: [],
  _idx: 0,
  
  INPUT: null,
  KEEP: null,
  SHOTS: null,
  TRASH: null,
  
  get stats() {
    return {
      hasPrev: this._idx > 0,
      hasNext: this._idx < this._files.length - 1,
      keep: this._files.filter(function(file) {
        return file.dir === File.KEEP;
      }).length,
      progress: this._idx + 1,
      total: this._files.length,
      trash: this._files.filter(function(file) {
        return file.dir === File.TRASH;
      }).length
    }
  },
  
  add: function(file) {
    if (this._files.indexOf(file) == -1)
      this._files.push(file);
  },
  
  fromName: function(filename) {
    for (var i = 0; i < this._files.length; i++) {
      if (this._files[i].name == filename) {
        return this._files[i];
      }
    }
    return null;
  },
  
  getFirst: function() {
    if (this._files.length == 0)
      return null;
    
    return this._files[0];
  },
  
  getNext: function() {
    if (this._idx < this._files.length - 1)
      this._idx++;
    
    return this._files[this._idx];
  },
  
  getPrev: function() {
    if (this._idx == 0)
      return null;
    
    this._idx--;
    return this._files[this._idx];
  },
  
  getTag: function(file) {
    for (var i in File) {
      if (File[i] == file.dir) {
        return i.toLowerCase();
      }
    }
  },
  
  sort: function() {
    this._files.sort(function(a, b) {
      return a.name > b.name;
    });
  }
};

module.exports = function(input) {
  input = path.resolve(rootPath, input);
  File.INPUT = fs.realpathSync(input);
  File.KEEP = utils.mkdirpSync(input + ".keep");
  File.SHOTS = utils.mkdirpSync(input + ".shots");
  File.TRASH = utils.mkdirpSync(input + ".trash");
  
  var count = 3;
  [File.INPUT, File.KEEP, File.TRASH].forEach(function(dir) {
    fs.readdir(dir, function(err, files) {
      files.forEach(function(file) {
        File.add({
          dir: dir,
          name: file
        });
      });
      
      if (!--count) {
        File.sort();
        http.createServer(onRequest).listen(8080);
        console.log("Server started at 127.0.0.1:8080".green);
        open("http://127.0.0.1:8080");
      }
    });
  });
}
