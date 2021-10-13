// Configuration variables

const environments = {
  staging: {
    httpPort: 3000,
    httpsPort: 3001,
    envName: "staging",
    hashSecret: "thisIsASecret",
  },
  production: {
    httpPort: 5000,
    httpsPort: 5001,
    envName: "production",
    hashSecret: "thisIsAlsoSecret",
  },
};

// Determine which environment was passed as a command-line argument
const currentEnvironment =
  typeof process.env.NODE_ENV === "string"
    ? process.env.NODE_ENV.toLocaleLowerCase()
    : "";

// Check that the current environment is one of the environments above, if not, default to the staging
const environmentToExport =
  typeof environments[currentEnvironment] == "object"
    ? environments[currentEnvironment]
    : environments.staging;

// Export the module
module.exports = environmentToExport;
