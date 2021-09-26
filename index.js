const http = require("http");
const https = require("https");
const url = require("url");
const StringDecoder = require("string_decoder").StringDecoder;
const config = require("./config");
const fs = require("fs");

// Instantiante the HTTP server
const httpServer = http.createServer(function (req, res) {
  unifiedServer(req, res);
});

// Instantiante the HTTPS server
const httpsServerOptions = {
  cert: fs.readFileSync("./https/cert.pem"),
  key: fs.readFileSync("./https/key.pem"),
};
const httpsServer = https.createServer(httpsServerOptions, function (req, res) {
  unifiedServer(req, res);
});

// Start the HTTP server
httpServer.listen(config.httpPort, function () {
  console.log(
    `server is listening on port ${config.httpPort} in ${config.envName}`
  );
});

// Start the HTTPS server
httpsServer.listen(config.httpsPort, function () {
  console.log(
    `server is listening on port ${config.httpsPort} in ${config.envName}`
  );
});

// Handle all the server logic for both the http and the https server
const unifiedServer = function (req, res) {
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

    // Choose the handler this request should call, if one is not found, use the notFound handler.
    const chosenHandler =
      typeof router[trimmedPath] !== "undefined"
        ? router[trimmedPath]
        : handlers.notFound;

    // Construct the data object to send to the handler
    const data = {
      trimmedPath,
      queryStringObject,
      method,
      headers,
      payload: buffer,
    };

    // Route the request to the handler specified in the router
    chosenHandler(data, function (statusCode = 200, payload = {}) {
      // Convert the payload to a string
      const payloadString = JSON.stringify(payload);

      // Return the response
      res.setHeader("Content-Type", "application/json");
      res.writeHead(statusCode);
      res.end(payloadString);

      console.log("Returned response:", statusCode, payloadString);
    });
  });
};

// Define handlers

const handlers = {
  // Ping handler
  ping(data, callback) {
    // Callback a httpStatus code
    callback(200);
  },
  // Not found handler
  notFound(data, callback) {
    callback(404);
  },
};

// Define a request router
const router = {
  ping: handlers.ping,
};
