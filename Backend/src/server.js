const express = require("express");
const config = require("./config");
const connectToDb = require("./db");

const PORT = config.PORT;

const app = express();

app.listen(PORT, () => {
  console.log(`Server Running at http://localhost:${PORT}`);
  connectToDb();
});
