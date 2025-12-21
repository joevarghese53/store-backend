import dotenv from "dotenv";
import connectDB from "../config/db.js";
import Tries from "../models/triesModel.js";

dotenv.config();

const run = async () => {
  await connectDB();

  const result = await Tries.updateMany(
    {},
    {
      $set: {
        freeTriesRemaining: 5,
        lastUpdated: new Date(),
      },
    }
  );

  console.log(`Reset done — ${result.modifiedCount} users updated`);
  process.exit(0);
};

run().catch((err) => {
  console.error("Cron failed:", err);
  process.exit(1);
});
