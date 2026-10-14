const mongoose = require('mongoose');

/**
 * Connect once and reuse the connection. On Vercel the module-level state survives
 * between invocations of a warm function, so we cache the in-flight promise globally.
 */
module.exports = async function connect() {
  if (mongoose.connection.readyState === 1) return;

  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error('MONGODB_URI is not set');

  if (!global.__mongoPromise) {
    global.__mongoPromise = mongoose
      .connect(uri, { bufferCommands: false, serverSelectionTimeoutMS: 8000 })
      .catch((err) => {
        global.__mongoPromise = null; // allow a retry on the next request
        throw err;
      });
  }
  await global.__mongoPromise;
};
