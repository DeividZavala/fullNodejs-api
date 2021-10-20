/**
 * Helpers for various tasks
 */

// Dependencies
const crypto = require("crypto");

const config = require("./config");
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
helpers.createRandomString = function(strLength) {
  strLength = typeof strLength === "number" && strLength > 0 ? strLength : false;
  if(strLength){
    // Define the possible characters that could go into a string
    const possibleCharacters = "abcdefghijklmnopqrstuvwxyz0123456789"

    // Start the final string
    let str = ""
    for(let i= 1; i<= strLength; i++){
      // Get a random character from the possibleCharacters string
      const randomCharacter = possibleCharacters.charAt(Math.floor(Math.random() * possibleCharacters.length));
      str+=randomCharacter
    }

    // Return the final string
    return str
  }else{
    return false
  }
}

module.exports = helpers;
