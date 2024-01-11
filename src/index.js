// require("dotenv").config({ path: "./env" });

//improved code below also add experimental feature in package.json dev command
import dotenv from "dotenv";

import mongoose from "mongoose";
import { DB_NAME } from "./constants.js";
import connectDB from "./db/index.js";

dotenv.config({ path: "./env" });

connectDB();

//
// import express from "express";
// const app = express()(async () => {
//   try {
//     await mongoose.connect(`${process.env.MONGODB_URI}/${DB_NAME}`);
//     app.on("error", (error) => {
//       console.log("ERRRR: ", error);
//       throw error;
//     });

//     app.listen(process.env.PORT, () => {
//       console.log(`app is listening on ${process.env.PORT}`);
//     });
//   } catch (error) {
//     console.log(error);
//   }
// })();
