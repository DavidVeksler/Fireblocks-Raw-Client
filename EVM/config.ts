const fs = require('fs');
const path = require('path');

// Assuming the API secret is stored in the same directory structure
const apiSecretPath = path.resolve("../FB_KEY/fireblocks_secret.key");
const apiSecret = fs.readFileSync(apiSecretPath, "utf8");

// Replace 'your_api_key_here' with your actual API key value
const apiKey = "";

module.exports = {
  apiSecret,
  apiKey,
};
