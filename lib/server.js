/**
 * Server related tasks
 */

const http = require("http");
const https = require("https");
const url = require("url");
const StringDecoder = require("string_decoder").StringDecoder;
const config = require("./config");
const fs = require("fs");
const handlers = require("./handlers");
const helpers = require("./helpers");
const path = require("path");
const util = require("util");
const debug = util.debuglog("server");

// Declare server object
const server = {};

// Instantiante the HTTP server
server.httpServer = http.createServer(function (req, res) {
  server.unifiedServer(req, res);
});

// Instantiante the HTTPS server
server.httpsServerOptions = {
  cert: fs.readFileSync(path.join(__dirname, "/../https/cert.pem")),
  key: fs.readFileSync(path.join(__dirname, "/../https/key.pem")),
};
server.httpsServer = https.createServer(
  server.httpsServerOptions,
  function (req, res) {
    server.unifiedServer(req, res);
  }
);

// Handle all the server logic for both the http and the https server
server.unifiedServer = function (req, res) {
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
    let chosenHandler =
      typeof server.router[trimmedPath] !== "undefined"
        ? server.router[trimmedPath]
        : handlers.notFound;

    // If the request is within the public directory, use the public handler instead

    chosenHandler =
      trimmedPath.indexOf("public/") > -1 ? handlers.public : chosenHandler;

    // Construct the data object to send to the handler
    const data = {
      trimmedPath,
      queryStringObject,
      method,
      headers,
      payload: helpers.parseJsonToObject(buffer),
    };

    // Route the request to the handler specified in the router
    chosenHandler(
      data,
      function (statusCode = 200, payload = {}, contentType = "json") {
        // Return the response parts that are content-type specific
        let payloadString = "";
        if (contentType === "json") {
          res.setHeader("Content-Type", "application/json");
          payloadString = JSON.stringify(payload);
        }
        if (contentType === "html") {
          res.setHeader("Content-Type", "text/html");
          payloadString = typeof payload === "string" ? payload : "";
        }

        if (contentType === "favicon") {
          res.setHeader("Content-Type", "image/x-icon");
          payloadString = typeof payload !== "undefined" ? payload : "";
        }

        if (contentType === "css") {
          res.setHeader("Content-Type", "text/css");
          payloadString = typeof payload !== "undefined" ? payload : "";
        }

        if (contentType === "png") {
          res.setHeader("Content-Type", "image/png");
          payloadString = typeof payload !== "undefined" ? payload : "";
        }

        if (contentType === "jpg") {
          res.setHeader("Content-Type", "image/jpeg");
          payloadString = typeof payload !== "undefined" ? payload : "";
        }

        if (contentType === "plain") {
          res.setHeader("Content-Type", "text/plain");
          payloadString = typeof payload !== "undefined" ? payload : "";
        }

        // Return the response parts that are common to all content-types
        res.writeHead(statusCode);
        res.end(payloadString);

        // If the response is 200, print greem otherwise print red
        if (statusCode == 200) {
          debug(
            "\x1b[32m%s\x1b[0m",
            `${method.toUpperCase()} /${trimmedPath} ${statusCode}`
          );
        } else {
          debug(
            "\x1b[31m%s\x1b[0m",
            `${method.toUpperCase()} /${trimmedPath} ${statusCode}`
          );
        }
      }
    );
  });
};

// Define a request router
server.router = {
  "": handlers.index,
  "account/create": handlers.accountCreate,
  "account/edit": handlers.accountEdit,
  "account/deleted": handlers.accountDeleted,
  "session/create": handlers.sessionCreate,
  "session/deleted": handlers.sessionDeleted,
  "checks/all": handlers.checkList,
  "checks/create": handlers.checksCreate,
  "checks/edit": handlers.checksEdit,
  ping: handlers.ping,
  "api/users": handlers.users,
  "api/tokens": handlers.tokens,
  "api/checks": handlers.checks,
  "favicon.ico": handlers.favicon,
  public: handlers.public,
};

// Init server function
server.init = function () {
  // Start the HTTP server
  server.httpServer.listen(config.httpPort, function () {
    console.log(
      "\x1b[36m%s\x1b[0m",
      `server is listening on port ${config.httpPort} in ${config.envName}`
    );
  });

  // Start the HTTPS server
  server.httpsServer.listen(config.httpsPort, function () {
    console.log(
      "\x1b[35m%s\x1b[0m",
      `server is listening on port ${config.httpsPort} in ${config.envName}`
    );
  });
};

// Export the server
module.exports = server;
