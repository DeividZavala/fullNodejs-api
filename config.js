// Configuration variables

const environments = {
  staging: {
    port: 3000,
    envName: "staging",
  },
  production: {
    port: 5000,
    envName: "production",
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
