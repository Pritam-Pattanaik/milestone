// Vercel Serverless Function Entry Point
const app = require('../server/src/index');

// Export the Express app as a serverless function
module.exports = app;
