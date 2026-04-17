// server/config/db.js
// MongoDB Atlas connection using Mongoose

const mongoose = require('mongoose');

let cached = global.mongoose;

if (!cached) {
  cached = global.mongoose = { conn: null, promise: null };
}

const connectDB = async () => {
  if (cached.conn) {
    return cached.conn;
  }

  if (!process.env.MONGO_URI) {
    throw new Error('Please define the MONGO_URI environment variable inside Vercel');
  }

  if (!cached.promise) {
    const opts = {
      bufferCommands: false,
    };

    cached.promise = mongoose.connect(process.env.MONGO_URI, opts).then((mongoose) => {
      console.log(`✅ MongoDB connected: ${mongoose.connection.host}`);
      return mongoose;
    }).catch(error => {
      console.error(`❌ MongoDB connection error: ${error.message}`);
      cached.promise = null;
      throw error;
    });
  }

  cached.conn = await cached.promise;
  return cached.conn;
};

module.exports = connectDB;
