const mongoose = require("mongoose");
const config = require("../config");

const connectToDb = async () => {
  try {
    const connection = await mongoose.connect(config.MONGO_URI);
    console.log(`DB Connected ${connection.connection.host}`);
  } catch (err) {
    console.error("DB connection error:", err.message);
    process.exit(1);
  }
};

module.exports = connectToDb;
