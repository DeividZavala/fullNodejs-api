const http = require("http");
const url = require("url");
const StringDecoder = require("string_decoder").StringDecoder;

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

  // Get payload if any
  const decoder = new StringDecoder("utf-8");
  let buffer = "";
  req.on("data", (data) => {
    buffer += decoder.write(data);
  });
  req.on("end", () => {
    buffer += decoder.end();
    res.end("hello World!");

    console.log("payload:", buffer);
  });
});

server.listen("3000", function () {
  console.log("server is listening on port 3000");
});
