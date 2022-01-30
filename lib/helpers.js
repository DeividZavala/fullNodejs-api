/**
 * Helpers for various tasks
 */

// Dependencies
const crypto = require("crypto");
const https = require("https");
const config = require("./config");
const path = require("path");
const fs = require("fs");
// Container for the helpers

const helpers = {};

// Create SHA256 hash

helpers.hash = function (str) {
  if (typeof str === "string" && str.length > 0) {
    const hash = crypto
      .createHmac("sha256", config.hashSecret)
      .update(str)
      .digest("hex");

    return hash;
  } else {
    return false;
  }
};
// Parse a JSON string to an Object in all cases, without throwing

helpers.parseJsonToObject = function (str) {
  try {
    const obj = JSON.parse(str);
    return obj;
  } catch (error) {
    return {};
  }
};

// Create a string of random alphanumeric characters, of a given length
helpers.createRandomString = function (strLength) {
  strLength =
    typeof strLength === "number" && strLength > 0 ? strLength : false;
  if (strLength) {
    // Define the possible characters that could go into a string
    const possibleCharacters = "abcdefghijklmnopqrstuvwxyz0123456789";

    // Start the final string
    let str = "";
    for (let i = 1; i <= strLength; i++) {
      // Get a random character from the possibleCharacters string
      const randomCharacter = possibleCharacters.charAt(
        Math.floor(Math.random() * possibleCharacters.length)
      );
      str += randomCharacter;
    }

    // Return the final string
    return str;
  } else {
    return false;
  }
};

// Send SMS messaga with Twilio
helpers.sendTwilioSms = function (phone, msg, callback) {
  // Validating parameters
  phone =
    typeof phone === "string" && phone.trim().length === 10
      ? phone.trim()
      : false;
  msg =
    typeof msg === "string" &&
    msg.trim().length > 0 &&
    msg.trim().length <= 1600
      ? msg.trim()
      : false;

  if (phone && msg) {
    // Configure Twilio payload
    const payload = {
      From: config.twilio.fromPhone,
      To: `+52${phone}`,
      Body: msg,
    };

    // Stringify the payload
    const stringPayload = new URLSearchParams(payload).toString();

    // Configure the request details
    const requestDetails = {
      protocol: "https:",
      hostname: "api.twilio.com",
      method: "POST",
      path: `/2010-04-01/Accounts/${config.twilio.accountSid}/Messages.json`,
      auth: `${config.twilio.accountSid}:${config.twilio.authToken}`,
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        "Content-Length": Buffer.byteLength(stringPayload),
      },
    };

    // Instantiate the request object
    const req = https.request(requestDetails, (res) => {
      const status = res.statusCode;
      if (status === 200 || status === 201) {
        callback(false);
      } else {
        callback("Status code returned was " + status);
      }
    });

    // Bind to the error event so it doesn't get thrown
    req.on("error", (e) => {
      callback(e);
    });

    // Add the payload
    req.write(stringPayload);

    // End the request
    req.end();
  } else {
    callback("Given parameters were missing or invalid");
  }
};

// Get the string content of a template
helpers.getTemplate = function (templateName, data, callback) {
  templateName =
    typeof templateName === "string" && templateName.length > 0
      ? templateName
      : false;
  data = typeof data === "object" && data !== null ? data : {};
  if (templateName) {
    const templateDir = path.join(__dirname, "/../templates/");
    fs.readFile(`${templateDir}${templateName}.html`, "utf8", (err, str) => {
      if (!err && str && str.length > 0) {
        // Do interpolation on the string
        const finalString = helpers.interpolate(str, data);
        callback(false, finalString);
      } else {
        callback("No template could be found");
      }
    });
  } else {
    callback("A valid template name was not specified");
  }
};

// Add the universal header and footer to a string, and pass the provided data object to the header and footer for interpolation
helpers.addUniversalTemplates = function (str, data, callback) {
  str = typeof str === "string" && str.length > 0 ? str : "";
  data = typeof data === "object" && data !== null ? data : {};
  // Get the header
  helpers.getTemplate("_header", data, function (err, headerString) {
    if (!err && headerString) {
      helpers.getTemplate("_footer", data, function (err, footerString) {
        if (!err && footerString) {
          // Add them all together
          const fullString = headerString + str + footerString;
          callback(false, fullString);
        } else {
          callback("Could not find the footer template");
        }
      });
    } else {
      callback("Could not find the header template");
    }
  });
};

// Take a given string ans data object and find/replace all the keys within it
helpers.interpolate = function (str, data) {
  str = typeof str === "string" && str.length > 0 ? str : "";
  data = typeof data === "object" && data !== null ? data : {};

  // Add the templateGlobals to the data object, prepending their key name with "global"
  for (let keyname in config.templateGlobals) {
    if (config.templateGlobals.hasOwnProperty(keyname)) {
      data["global." + keyname] = config.templateGlobals[keyname];
    }
  }

  // For each key in tghe data object, insert its value into the string at the corresponding placeholder
  for (let key in data) {
    if (data.hasOwnProperty(key) && typeof data[key] === "string") {
      let replace = data[key];
      let find = `{${key}}`;
      str = str.replace(find, replace);
    }
  }

  return str;
};

module.exports = helpers;
