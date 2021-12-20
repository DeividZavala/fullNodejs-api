/**
 * Request Handlers
 */

// Dependencies
const _data = require("./data");
const helpers = require("./helpers");
const config = require("./config");

// Define the handlers
const handlers = {};

// Users
handlers.users = function (data, callback) {
  const acceptableMethods = ["get", "post", "put", "delete"];
  if (acceptableMethods.indexOf(data.method) > -1) {
    handlers._users[data.method](data, callback);
  } else {
    callback(405);
  }
};

// Container fot the users submethods
handlers._users = {};

// Users - POST
// Required data: firstName, lastName, phone, password, tosAgreement
// Optional data: none
handlers._users.post = function (data, callback) {
  const firstName =
    typeof data.payload.firstName === "string" &&
    data.payload.firstName.trim().length > 0
      ? data.payload.firstName.trim()
      : false;

  const lastName =
    typeof data.payload.lastName === "string" &&
    data.payload.lastName.trim().length > 0
      ? data.payload.lastName.trim()
      : false;

  const phone =
    typeof data.payload.phone === "string" &&
    data.payload.phone.trim().length === 10
      ? data.payload.phone.trim()
      : false;

  const password =
    typeof data.payload.password === "string" &&
    data.payload.password.trim().length > 0
      ? data.payload.password.trim()
      : false;

  const tosAgreement =
    typeof data.payload.tosAgreement === "boolean" && data.payload.tosAgreement
      ? true
      : false;

  if ((firstName, lastName, phone, password, tosAgreement)) {
    // Make sure that the user doesnt already exist
    _data.read("users", phone, function (err) {
      if (err) {
        // Hash password
        const hashedPassword = helpers.hash(password);

        if (hashedPassword) {
          // Create the user object
          const userObj = {
            firstName,
            lastName,
            phone,
            password: hashedPassword,
            tosAgreement: true,
          };

          // Store the user
          _data.create("users", phone, userObj, function (err) {
            if (!err) {
              callback(200);
            } else {
              console.error(err);
              callback(500, { error: "Could not create the new user" });
            }
          });
        } else {
          callback(500, { error: "Could not hash the password" });
        }
      } else {
        callback(400, { error: "A user with that phone already exists" });
      }
    });
  } else {
    callback(400, { error: "Missing required fields" });
  }
};

// Users - GET
// Required data: phone
// Optional data: none
handlers._users.get = function (data, callback) {
  // Check that the phone number is valid
  const phone =
    typeof data.queryStringObject.phone === "string" &&
    data.queryStringObject.phone.trim().length === 10
      ? data.queryStringObject.phone.trim()
      : false;

  if (phone) {
    // GET the token from the headers
    const token =
      typeof data.headers.token === "string" ? data.headers.token : false;

    // Verify that the given token is valid for the phone number
    handlers._tokens.verifyToken(token, phone, function (tokenIsValid) {
      if (tokenIsValid) {
        // Lookup the user
        _data.read("users", phone, function (err, data) {
          if (!err && data) {
            // Remove the password from the user object before returning it ro the requester
            const { password, ...safeUser } = data;
            callback(200, safeUser);
          } else {
            callback(404, { error: "Could not find specified user" });
          }
        });
      } else {
        callback(403, {
          error: "Missing required token in header, or token is invalid",
        });
      }
    });
  } else {
    callback(400, { error: "Missing required fields" });
  }
};

// Users - PUT
// Required data: phone
// Optional data: firstName, lastName, password (At least one must be specified)
handlers._users.put = function (data, callback) {
  // Check for the required field
  const phone =
    typeof data.queryStringObject.phone === "string" &&
    data.queryStringObject.phone.trim().length === 10
      ? data.queryStringObject.phone.trim()
      : false;

  // Check for the optional fields
  const firstName =
    typeof data.payload.firstName === "string" &&
    data.payload.firstName.trim().length > 0
      ? data.payload.firstName.trim()
      : false;

  const lastName =
    typeof data.payload.lastName === "string" &&
    data.payload.lastName.trim().length > 0
      ? data.payload.lastName.trim()
      : false;

  const password =
    typeof data.payload.password === "string" &&
    data.payload.password.trim().length > 0
      ? data.payload.password.trim()
      : false;

  if (phone) {
    if (firstName || lastName || password) {
      // GET the token from the headers
      const token =
        typeof data.headers.token === "string" ? data.headers.token : false;

      // Verify that the given token is valid for the phone number
      handlers._tokens.verifyToken(token, phone, function (tokenIsValid) {
        if (tokenIsValid) {
          _data.read("users", phone, function (err, data) {
            if (!err && data) {
              if (firstName) {
                data.firstName = firstName;
              }
              if (lastName) {
                data.lastName = lastName;
              }
              if (password) {
                data.password = helpers.hash(password);
              }

              // Store the new updates
              _data.update("users", phone, data, function (err) {
                if (!err) {
                  callback(200);
                } else {
                  console.log(err);
                  callback(500, { error: "Could not update the user" });
                }
              });
            } else {
              callback(404, { error: "The specified user does not exist" });
            }
          });
        } else {
          callback(403, {
            error: "Missing required token in headers, or token is invalid",
          });
        }
      });
    } else {
      callback(400, { error: "Missing fields to update" });
    }
  } else {
    callback(400, { error: "Missing required fields" });
  }
};

// Users - DELETE
// Required data: phone
// Optional data: none
// @TODO Cleanup (delete) any other data files associated with this user
handlers._users.delete = function (data, callback) {
  // Check that the phone number is valid
  const phone =
    typeof data.queryStringObject.phone === "string" &&
    data.queryStringObject.phone.trim().length === 10
      ? data.queryStringObject.phone.trim()
      : false;

  if (phone) {
    // GET the token from the headers
    const token =
      typeof data.headers.token === "string" ? data.headers.token : false;

    // Verify that the given token is valid for the phone number
    handlers._tokens.verifyToken(token, phone, function (tokenIsValid) {
      if (tokenIsValid) {
        _data.read("users", phone, function (err, userData) {
          if (!err && userData) {
            _data.delete("users", phone, function (err) {
              if (!err) {
                // Delete all the checks associated with the user
                const userChecks =
                  typeof userData.checks === "object" &&
                  userData.checks instanceof Array
                    ? userData.checks
                    : [];
                if (userChecks.length > 0) {
                  const checksToDelete = userChecks.length;
                  let deletionErrors = false;
                  let checksDeleted = 0;
                  userChecks.forEach(function (checkId) {
                    _data.delete("checks", checkId, function (err) {
                      if (err) {
                        deletionErrors = true;
                      }
                      checksDeleted++;
                      if (checksDeleted === checksToDelete) {
                        if (!deletionErrors) {
                          callback(200);
                        } else {
                          callback(500, {
                            error:
                              "Errors encountered while deleting the user's checks. All checks may not have been deleted from the system successfully.",
                          });
                        }
                      }
                    });
                  });
                } else {
                  callback(200);
                }
              } else {
                callback(500, { error: "Could not delete the specified user" });
              }
            });
          } else {
            callback(404, { error: "Could not find the specified user" });
          }
        });
      } else {
        callback(403, {
          error: "Missing required token in headers or token invalid",
        });
      }
    });
  } else {
    callback(400, { error: "Missing required fields" });
  }
};

// Tokens

handlers.tokens = function (data, callback) {
  const acceptableMethods = ["get", "post", "put", "delete"];
  if (acceptableMethods.indexOf(data.method) > -1) {
    handlers._tokens[data.method](data, callback);
  } else {
    callback(405);
  }
};

// Container for all the tokens methods

handlers._tokens = {};

// TOKENS - POST
// REQUIRE DATA:  PHONE, PASSWORD
// OPTIONAL DATA: NONE
handlers._tokens.post = function (data, callback) {
  const phone =
    typeof data.payload.phone === "string" &&
    data.payload.phone.trim().length === 10
      ? data.payload.phone.trim()
      : false;

  const password =
    typeof data.payload.password === "string" &&
    data.payload.password.trim().length > 0
      ? data.payload.password.trim()
      : false;

  if (phone && password) {
    // Lookup the user who matches that phone number
    _data.read("users", phone, function (err, data) {
      if (!err && data) {
        // Hash the sent password and compare it with the password stored in the user object
        const hashedPassword = helpers.hash(password);
        if (hashedPassword === data.password) {
          // If valid, create a new token with random name. Set expiration date one hour in the future
          const token = helpers.createRandomString(20);
          const expires = Date.now() + 1000 * 60 * 60;

          const tokenObject = {
            phone,
            token,
            expires,
          };

          _data.create("tokens", token, tokenObject, function (err) {
            if (!err) {
              callback(200, tokenObject);
            } else {
              callback(500, { error: "Could not create the new token" });
            }
          });
        } else {
          callback(400, {
            error: "password did not match user stored password",
          });
        }
      } else {
        callback(404, { error: "Could not find specified user" });
      }
    });
  } else {
    callback(400, { error: "Missing required field(s)" });
  }
};

// TOKENS -  GET
// REQUIRED DATA: PHONE
// OPTIONAL DATA: NONE
handlers._tokens.get = function (data, callback) {
  // Check that the ID is valid
  const id =
    typeof data.queryStringObject.id === "string" &&
    data.queryStringObject.id.trim().length === 20
      ? data.queryStringObject.id.trim()
      : false;

  if (id) {
    // Lookup the token
    _data.read("tokens", id, function (err, token) {
      if (!err && token) {
        callback(200, token);
      } else {
        callback(404);
      }
    });
  } else {
    callback(400, { error: "Missing required fields" });
  }
};

// TOKENS -  PUT
// REQUIRED DATA: ID, EXTEND
// OPTIONAL DATA: NONE
handlers._tokens.put = function (data, callback) {
  // Check that the ID is valid
  const id =
    typeof data.payload.id === "string" && data.payload.id.trim().length === 20
      ? data.payload.id.trim()
      : false;

  const extend =
    typeof data.payload.extend === "boolean" && data.payload.extend
      ? data.payload.extend
      : false;

  if (id && extend) {
    // Lookup the token
    _data.read("tokens", id, function (err, tokenData) {
      if (!err && tokenData) {
        // Check to make sure the token is not already expired
        if (tokenData.expires > Date.now()) {
          // Set the expiration an hour from now
          tokenData.expires = Date.now() + 1000 * 60 * 60;

          // Store the new updates
          _data.update("tokens", id, tokenData, function (err) {
            if (!err) {
              callback(200);
            } else {
              callback(500, { error: "Could not update token's expiration" });
            }
          });
        } else {
          callback(400, {
            error: "Token has already expires, and cannot be extended",
          });
        }
      } else {
        callback(400, { error: "Specified token does not exist" });
      }
    });
  } else {
    callback(400, {
      error: "Missing required field(s) or field(s) are invalid",
    });
  }
};

// TOKENS - DELETE
// REQUIRED DATA: ID
// OPTIONAL DATA: NONE
handlers._tokens.delete = function (data, callback) {
  // Check that the token is valid
  const id =
    typeof data.queryStringObject.id === "string" &&
    data.queryStringObject.id.trim().length === 20
      ? data.queryStringObject.id.trim()
      : false;

  if (id) {
    _data.read("tokens", id, function (err, data) {
      if (!err && data) {
        _data.delete("tokens", id, function (err) {
          if (!err) {
            callback(200);
          } else {
            callback(500, { error: "Could not delete the specified token" });
          }
        });
      } else {
        callback(404, { error: "Could not find the specified token" });
      }
    });
  } else {
    callback(400, { error: "Missing required fields" });
  }
};

// TOKENS - VERIFY
// verify if a given token id is currently valid fir a given user
handlers._tokens.verifyToken = function (id, phone, callback) {
  // Lookup the token
  _data.read("tokens", id, function (err, tokenData) {
    if (!err && tokenData) {
      // Check that the token is for the given user and has not expired
      if (tokenData.phone === phone && tokenData.expires > Date.now()) {
        callback(true);
      } else {
        callback(false);
      }
    } else {
      callback(false);
    }
  });
};

// CHECKS

handlers.checks = function (data, callback) {
  const acceptableMethods = ["get", "post", "put", "delete"];
  if (acceptableMethods.indexOf(data.method) > -1) {
    handlers._checks[data.method](data, callback);
  } else {
    callback(405);
  }
};

// Container for all the tokens methods

handlers._checks = {};

// CHECKS - POST
// Required data: protocol, url, method, successCodes, timeoutSeconds
// Optional data: none

handlers._checks.post = function (data, callback) {
  // Validate inputs
  const protocol =
    typeof data.payload.protocol === "string" &&
    ["https", "http"].indexOf(data.payload.protocol) > -1
      ? data.payload.protocol.trim()
      : false;
  const url =
    typeof data.payload.url === "string" && data.payload.url.trim().length > 0
      ? data.payload.url.trim()
      : false;
  const method =
    typeof data.payload.method === "string" &&
    ["get", "post", "put", "delete"].indexOf(data.payload.method) > -1
      ? data.payload.protocol.trim()
      : false;
  const successCodes =
    typeof data.payload.successCodes === "object" &&
    data.payload.successCodes instanceof Array &&
    data.payload.successCodes.length > 0
      ? data.payload.successCodes
      : false;
  const timeoutSeconds =
    typeof data.payload.timeoutSeconds === "number" &&
    data.payload.timeoutSeconds >= 1 &&
    data.payload.timeoutSeconds <= 5
      ? data.payload.timeoutSeconds
      : false;

  if (protocol && url && method && successCodes && timeoutSeconds) {
    // Get the token from the headers
    const token =
      typeof data.headers.token === "string" ? data.headers.token : false;

    // Lookup the user by reading the token
    _data.read("tokens", token, (err, tokenData) => {
      if (!err && tokenData) {
        // Lookup the user data
        _data.read("users", tokenData.phone, (err, userData) => {
          if (!err && userData) {
            const userChecks =
              typeof userData.checks === "object" &&
              userData.checks instanceof Array
                ? userData.checks
                : [];
            if (userChecks.length < config.maxChecks) {
              // Create a random id for the check
              const checkId = helpers.createRandomString(20);

              // Create the check object and include the user's phone
              const checkObject = {
                id: checkId,
                userPhone: tokenData.phone,
                protocol,
                url: url,
                method,
                successCodes,
                timeoutSeconds,
              };
              _data.create("checks", checkId, checkObject, (err) => {
                if (!err) {
                  // Add the check id to the user object
                  userData.checks = userChecks;
                  userData.checks.push(checkId);

                  // Update the user data
                  _data.update("users", tokenData.phone, userData, (err) => {
                    if (!err) {
                      // Return the check object to the requester
                      callback(200, checkObject);
                    } else {
                      callback(500, {
                        error: "Could not update the user with the new check",
                      });
                    }
                  });
                } else {
                  callback(500, { error: "Could not create the new check" });
                }
              });
            } else {
              callback(400, {
                error: `The user already has the maximum number of checks (${config.maxChecks})`,
              });
            }
          } else {
            callback(403);
          }
        });
      } else {
        callback(403);
      }
    });
  } else {
    callback(400, { error: "Missing required fields or fields are invalid." });
  }
};

// CHECKS - GET
// Required data: id
// Optional data: none
handlers._checks.get = function (data, callback) {
  // Check that the phone number is valid
  const id =
    typeof data.queryStringObject.id === "string" &&
    data.queryStringObject.id.trim().length === 20
      ? data.queryStringObject.id.trim()
      : false;

  if (id) {
    // Lookup the check
    _data.read("checks", id, (err, checkData) => {
      if (!err && checkData) {
        // GET the token from the headers
        const token =
          typeof data.headers.token === "string" ? data.headers.token : false;

        // Verify that the given token is valid and belongs to the user that created the check
        handlers._tokens.verifyToken(
          token,
          checkData.userPhone,
          function (tokenIsValid) {
            if (tokenIsValid) {
              callback(200, checkData);
            } else {
              callback(403);
            }
          }
        );
      } else {
        callback(404);
      }
    });
  } else {
    callback(400, { error: "Missing required fields" });
  }
};

// CHECKS - PUT
// Required data: id
// Optional data: protocol, url, method, successCodes, timeoutSeconds (one must be sent)

handlers._checks.put = function (data, callback) {
  const id =
    typeof data.payload.id === "string" && data.payload.id.trim().length === 20
      ? data.payload.id.trim()
      : false;

  // Validating optional inputs
  const protocol =
    typeof data.payload.protocol === "string" &&
    ["https", "http"].indexOf(data.payload.protocol) > -1
      ? data.payload.protocol.trim()
      : false;
  const url =
    typeof data.payload.url === "string" && data.payload.url.trim().length > 0
      ? data.payload.url.trim()
      : false;
  const method =
    typeof data.payload.method === "string" &&
    ["get", "post", "put", "delete"].indexOf(data.payload.method) > -1
      ? data.payload.protocol.trim()
      : false;
  const successCodes =
    typeof data.payload.successCodes === "object" &&
    data.payload.successCodes instanceof Array &&
    data.payload.successCodes.length > 0
      ? data.payload.successCodes
      : false;
  const timeoutSeconds =
    typeof data.payload.timeoutSeconds === "number" &&
    data.payload.timeoutSeconds >= 1 &&
    data.payload.timeoutSeconds <= 5
      ? data.payload.timeoutSeconds
      : false;

  if (id) {
    // Checking that at least one optional field was sent
    if (protocol || url || method || successCodes || timeoutSeconds) {
      _data.read("checks", id, (err, checkData) => {
        if (!err && checkData) {
          // GET the token from the headers
          const token =
            typeof data.headers.token === "string" ? data.headers.token : false;

          // Verify that the given token is valid and belongs to the user that created the check
          handlers._tokens.verifyToken(
            token,
            checkData.userPhone,
            function (tokenIsValid) {
              if (tokenIsValid) {
                // Update the check where necessary
                if (protocol) {
                  checkData.protocol = protocol;
                }
                if (url) {
                  checkData.url = url;
                }
                if (method) {
                  checkData.method = method;
                }
                if (successCodes) {
                  checkData.successCodes = successCodes;
                }
                if (timeoutSeconds) {
                  checkData.timeoutSeconds = timeoutSeconds;
                }

                _data.update("checks", id, checkData, (err) => {
                  if (!err) {
                    callback(200);
                  } else {
                    callback(500, { error: "Could not update the check" });
                  }
                });
              } else {
                callback(403);
              }
            }
          );
        } else {
          callback(400, { error: "Check ID does not exist" });
        }
      });
    } else {
      callback(400, { error: "Missing fields to update" });
    }
  } else {
    callback(400, { error: "Missing required field" });
  }
};

// CHECKS - DELETE
// Required data: id
// Optional data: none
handlers._checks.delete = function (data, callback) {
  // Check that the id is valid
  const id =
    typeof data.queryStringObject.id === "string" &&
    data.queryStringObject.id.trim().length === 20
      ? data.queryStringObject.id.trim()
      : false;

  if (id) {
    // Lookup the check
    _data.read("checks", id, (err, checkData) => {
      if (!err && checkData) {
        // GET the token from the headers
        const token =
          typeof data.headers.token === "string" ? data.headers.token : false;

        // Verify that the given token is valid for the phone number
        handlers._tokens.verifyToken(
          token,
          checkData.userPhone,
          function (tokenIsValid) {
            if (tokenIsValid) {
              // Delete the check
              _data.delete("checks", id, (err) => {
                if (!err) {
                  _data.read(
                    "users",
                    checkData.userPhone,
                    function (err, userData) {
                      if (!err && userData) {
                        const userChecks =
                          typeof userData.checks === "object" &&
                          userData.checks instanceof Array
                            ? userData.checks
                            : [];

                        const filteredUserChecks = userChecks.filter(
                          (item) => item !== id
                        );
                        _data.update(
                          "users",
                          checkData.userPhone,
                          { ...userData, checks: filteredUserChecks },
                          function (err) {
                            if (!err) {
                              callback(200);
                            } else {
                              callback(500, {
                                error: "Could not update the specified user",
                              });
                            }
                          }
                        );
                      } else {
                        callback(500, {
                          error:
                            "Could not find the user who created the check, so could not remove the check from the list of checks on the user object",
                        });
                      }
                    }
                  );
                } else {
                  callback(500, { error: "Could not delete the check" });
                }
              });
            } else {
              callback(403);
            }
          }
        );
      } else {
        callback(404, { error: "Check ID does not exist" });
      }
    });
  } else {
    callback(400, { error: "Missing required fields" });
  }
};

// Ping handlers
handlers.ping = function (data, callback) {
  // Callback a httpStatus code
  callback(200);
};

// Not found handler
handlers.notFound = function (data, callback) {
  callback(404);
};

module.exports = handlers;
