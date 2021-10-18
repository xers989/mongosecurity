const { CsfleHelper } = require("./helpers");
const fs = require("fs");


function getCheckedEnv(...envVars) {
  if (envVars.some((elem) => !process.env[elem])) {
    throw new Error(
      `Found no environmental variables set for the following values: ${envVars
        .filter((elem) => !process.env[elem])
        .join(", ")}`
    );
  } else {
    return envVars.reduce((acc, curr) => {
      acc[envToKey[curr]] = process.env[curr];
      return acc;
    }, {});
  }
}

function readMasterKey(path = "./master-key.txt") {
  return fs.readFileSync(path);
}

module.exports = {
  localCsfleHelper: (path = "./master-key.txt") => {
    return new CsfleHelper({
      provider: "local",
      kmsProviders: {
        local: {
          key: readMasterKey(path),
        },
      },
    });
  },
  getDataKey: () => {
    return "zwRM0VwoQUqNrnIcg8LQqw=="; // change this to the base64 encoded data key generated from make-data-key.js
  }
};
