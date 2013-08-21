var http = require("http");
var fs = require("fs");
var url = require("url");
var qs = require("querystring");
var handlebars = require("handlebars");

var api = require("./api");

var videos = {
  all: [],
  removed: [],
  uncategorized: []
};

// list files in video directory
fs.realpath(global.vidDir, function(err, absPath) {
  if (err) {
    console.error(err);
    return;
  }
  
  fs.readdir(absPath, function(err, files) {
    if (err) {
      console.error(err);
      return;
    }
    
    videos.all = files;
  });
});

module.exports.HttpServer = HttpServer;
function HttpServer(req, resp) {
  var urlInfo = url.parse(req.url);
  var params = qs.parse((urlInfo.search || "").substr(1));
  
  // it's an API request - let the api module handle this
  if (urlInfo.pathname == "/api") {
    resp.writeHead(200, {"Content-Type": "application/json"});
    api(params, function(data) {
      resp.end(JSON.stringify(data));
    });
    return;
  }
  
  // show gallery
  fs.realpath("templates/index.html", function(err, absPath) {
    if (err) {
      resp.end();
      return;
    }
    
    fs.readFile(absPath, function(err, content) {
      if (err) {
        resp.end();
        return;
      }
      
      template = handlebars.compile(content.toString());
      resp.end(template(videos));
    });
  });
}
