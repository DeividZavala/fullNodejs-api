/**
 * Workers related tasks
 */

// Dependencies
const path = require("path");
const fs = require("fs");
const _data = require("./data");
const http = require("http");
const helpers = require("./helpers");
const https = require("https");
const url = require("url");
const _logs = require("./logs");

// Instantiante the worker object
const workers = {};

// Perform the check, send the originalCheckData and the outcome to the next step of the process
workers.performCheck = function (originalCheckData) {
  // Prepare the initial check outcome
  const checkOutCome = {
    error: false,
    responseCode: false,
  };

  // Mark that the outcome has not been sent yet
  let outcomeSent = false;
  // Parse the hostname and the path of the original check
  const parsedUrl = url.parse(
    originalCheckData.protocol + "://" + originalCheckData.url,
    true
  );
  const hostName = parsedUrl.hostname;
  const path = parsedUrl.path;

  // Construct the request
  const requestDetails = {
    protocol: `${originalCheckData.protocol}:`,
    hostname: hostName,
    method: originalCheckData.method.toUpperCase(),
    path,
    timeout: originalCheckData.timeoutSeconds * 1000,
  };

  // Instantiate the request object
  const _moduleToUse = originalCheckData.protocol == "http" ? http : https;
  const req = _moduleToUse.request(requestDetails, function (res) {
    // Grab the status of the sent request
    const status = res.statusCode;

    // Update the checkOutcome
    checkOutCome.responseCode = status;

    // Update the check data
    if (!outcomeSent) {
      workers.processCheckOutcome(originalCheckData, checkOutCome);
      outcomeSent = true;
    }
  });

  // Bind to the error event so it doesn't get thrown
  req.on("error", function (e) {
    // Update the checkOutcome
    checkOutCome.error = {
      error: true,
      value: e,
    };
    if (!outcomeSent) {
      workers.processCheckOutcome(originalCheckData, checkOutCome);
      outcomeSent = true;
    }
  });

  // Bind to the timeout event
  req.on("timeout", function (e) {
    // Update the checkOutcome
    checkOutCome.error = {
      error: true,
      value: "timeout",
    };
    if (!outcomeSent) {
      workers.processCheckOutcome(originalCheckData, checkOutCome);
      outcomeSent = true;
    }
  });

  // End the request
  req.end();
};

// Alert a user to a change in their check status
workers.alertUserToStatusChange = function (newCheckData) {
  const msg = `Alert: Your check for ${newCheckData.method.toUpperCase()} ${
    newCheckData.protocol
  }://${newCheckData.url} is currently ${newCheckData.state}`;
  helpers.sendTwilioSms(newCheckData.userPhone, msg, function (err) {
    if (!err) {
      console.log(
        "Success was alerted to a status change on their check, via SMS",
        msg
      );
    } else {
      console.log("Error: Could not send sms alert to user");
    }
  });
};

// Process the check outcome, update the check data as needed, trigger an alert if needed
// Special logic for accomodating a check that has never been tested before (don't alert on that one)
workers.processCheckOutcome = function (originalCheckData, checkOutcome) {
  // Decide if the check is considered up or down
  const state =
    !checkOutcome.error &&
    checkOutcome.responseCode &&
    originalCheckData.successCodes.indexOf(checkOutcome.responseCode) > -1
      ? "up"
      : "down";

  // Decide if an alert is warranted
  const alertWarranted =
    originalCheckData.lastChecked && originalCheckData.state !== state
      ? true
      : false;

  // Log the outcome
  const timeOfCheck = Date.now();
  workers.log(
    originalCheckData,
    checkOutcome,
    state,
    alertWarranted,
    timeOfCheck
  );

  // Update check data
  const newCheckData = originalCheckData;
  newCheckData.state = state;
  newCheckData.lastChecked = timeOfCheck;

  // Save the updates
  _data.update("checks", newCheckData.id, newCheckData, function (err) {
    if (!err) {
      // Send the new checkData to the next phase in the process if needed
      if (alertWarranted) {
        workers.alertUserToStatusChange(newCheckData);
      } else {
        console.log("Check outcome has not changed, no alert needed");
      }
    } else {
      console.log("Error trying to save updates to one of the checks");
    }
  });
};

// Sanity-check the check-data
workers.validateCheckData = function (originalCheckData) {
  originalCheckData =
    typeof originalCheckData == "object" && originalCheckData !== null
      ? originalCheckData
      : {};
  originalCheckData.id =
    typeof originalCheckData.id == "string" &&
    originalCheckData.id.trim().length === 20
      ? originalCheckData.id
      : false;
  originalCheckData.userPhone =
    typeof originalCheckData.userPhone == "string" &&
    originalCheckData.userPhone.trim().length === 10
      ? originalCheckData.userPhone
      : false;
  originalCheckData.protocol =
    typeof originalCheckData.protocol == "string" &&
    ["http", "https"].indexOf(originalCheckData.protocol) > -1
      ? originalCheckData.protocol
      : false;
  originalCheckData.url =
    typeof originalCheckData.url == "string" &&
    originalCheckData.url.trim().length > 0
      ? originalCheckData.url
      : false;
  originalCheckData.method =
    typeof originalCheckData.method == "string" &&
    ["post", "get", "put", "delete"].indexOf(originalCheckData.method) > -1
      ? originalCheckData.method
      : false;
  originalCheckData.successCodes =
    typeof originalCheckData.successCodes === "object" &&
    originalCheckData.successCodes instanceof Array &&
    originalCheckData.successCodes.length > 0
      ? originalCheckData.successCodes
      : false;
  originalCheckData.timeoutSeconds =
    typeof originalCheckData.timeoutSeconds == "number" &&
    originalCheckData.timeoutSeconds % 1 === 0 &&
    originalCheckData.timeoutSeconds >= 1 &&
    originalCheckData.timeoutSeconds <= 5
      ? originalCheckData.timeoutSeconds
      : false;

  // Set the keys that may not be set (if workers have never seen this checks before)
  originalCheckData.state =
    typeof originalCheckData.state == "string" &&
    ["up", "down"].indexOf(originalCheckData.state) > -1
      ? originalCheckData.state
      : "down";
  originalCheckData.lastChecked =
    typeof originalCheckData.lastChecked === "number" &&
    originalCheckData.lastChecked > 0
      ? originalCheckData.lastChecked
      : false;

  // If all the checks pass, pass the check to the next step of the process
  if (
    originalCheckData &&
    originalCheckData.id &&
    originalCheckData.userPhone &&
    originalCheckData.protocol &&
    originalCheckData.url &&
    originalCheckData.method &&
    originalCheckData.successCodes &&
    originalCheckData.timeoutSeconds
  ) {
    workers.performCheck(originalCheckData);
  } else {
    console.log("Error: One of the checks is not properly formatted");
  }
};

// Lookup all the checks, get their data, send to a validator
workers.gatherAllChecks = function () {
  // Get all the checks
  _data.list("checks", function (err, checks) {
    if (!err && checks && checks.length > 0) {
      checks.forEach(function (check) {
        _data.read("checks", check, function (err, originalCheckData) {
          if (!err && originalCheckData) {
            // Validating check data
            workers.validateCheckData(originalCheckData);
          } else {
            console.log("Error reading one of the checks");
          }
        });
      });
    } else {
      console.log("Error: Could not find any checks to process");
    }
  });
};

//
workers.log = function (
  originalCheckData,
  checkOutcome,
  state,
  alertWarranted,
  timeOfCheck
) {
  // Form the log data
  const logData = {
    check: originalCheckData,
    outcome: checkOutcome,
    state: state,
    alert: alertWarranted,
    time: timeOfCheck,
  };

  // Convert data to string
  const logsString = JSON.stringify(logData);

  // Determine the name of the log file
  const logFileName = originalCheckData.id;

  // Append the log to the file
  _logs.append(logFileName, logsString, function (err) {
    if (!err) {
      console.log("Logging to file succeeded");
    } else {
      console.log("Logging to file failed");
    }
  });
};

// Timer to execute the checks every minute
workers.loop = function () {
  setInterval(function () {
    workers.gatherAllChecks();
  }, 1000 * 60);
};

// Rotate (compress) the log files
workers.rotateLogs = function () {
  // List all the (non-compressed) log files
  _logs.list(false, function (err, logs) {
    if (!err && logs?.length > 0) {
      logs.forEach(function (logName) {
        // Compress the data to a different file
        const logId = logName.replace(".log", "");
        const newFileId = `${logId}-${Date.now()}`;
        _logs.compress(logId, newFileId, function (err) {
          if (!err) {
            // Truncate the log
            _logs.truncate(logId, function (err) {
              if (!err) {
                console.log("Success truncating the logFile");
              } else {
                console.log("Error truncating logFile");
              }
            });
          } else {
            console.log("Error compressing one of the log files", err);
          }
        });
      });
    } else {
      console.log("Error: Could not find any logs to rotate");
    }
  });
};

// Timer to execute the log-rotation daily
workers.logRotationLoop = function () {
  setInterval(function () {
    workers.rotateLogs();
  }, 1000 * 60 * 60 * 24);
};

// Init script
workers.init = function () {
  // Execute all the check inmediatly
  workers.gatherAllChecks();

  // Call the loop so the checks will execute later on
  workers.loop();

  // Compress all the logs immediately
  workers.rotateLogs();

  // Call the compression loop so logs will be compressed later on
  workers.logRotationLoop();
};

// Export the worker object
module.exports = workers;
