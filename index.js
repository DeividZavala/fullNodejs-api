const http = require("http");
const url = require("url");

const server = http.createServer(function (req, res) {
  //Getting the url and parsing it
  const parsedUrl = url.parse(req.url, true);

  // Getting the path
  const path = parsedUrl.pathname;
  const trimmedPath = path.replace(/^\/+|\/+$/g, "");

  // Getting the HTTP method
  const method = req.method.toLocaleLowerCase();

  // Getting query string object
  const queryStringObject = parsedUrl.query;

  // Get headers as an object
  const headers = req.headers;

  res.end("hello World!");

  console.log(headers);
});

server.listen("3000", function () {
  console.log("server is listening on port 3000");
});
