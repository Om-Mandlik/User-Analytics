// Local development only: runs the same Express app as a normal server on port 4000.
// (On Vercel the app is exported through api/index.js instead.)
require('dotenv').config();
if (!process.env.MONGODB_URI) process.env.MONGODB_URI = 'mongodb://127.0.0.1:27017/user_analytics';

const app = require('./app');
const connect = require('./db');
const PORT = process.env.PORT || 4000;

connect()
  .then(() => app.listen(PORT, () => console.log(`API listening on http://localhost:${PORT}/api/health`)))
  .catch((err) => {
    console.error('Could not connect to MongoDB:', err.message);
    process.exit(1);
  });
