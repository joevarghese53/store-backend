import cron from "node-cron";
import Tries from "../models/triesModel.js";

const resetFreeTries = () => {
  cron.schedule("15 10 * * *", async () => {
    // Change "30 14 * * *" to your desired time (HH:mm in 24-hour format).
    console.log("Running reset of free tries...");

    try {
      const result = await Tries.updateMany(
        {}, // Apply to all users
        { 
          $set: { freeTriesRemaining: 5 }, // Reset free tries to 5
          lastUpdated: new Date(), // Update the last reset time
        }
      );

      console.log(`Free tries reset for ${result.modifiedCount} users.`);
    } catch (error) {
      console.error("Error resetting free tries:", error);
    }
  }, {
    timezone: "Asia/Kolkata", // Indian Standard Time
  });
};

export default resetFreeTries;
