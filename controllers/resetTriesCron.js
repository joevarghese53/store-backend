// utils/resetFreeTriesCron.js
import cron from "node-cron";
import Tries from "../models/triesModel.js";

let isCronRunning = false; // safety flag to avoid duplicate schedules

const resetFreeTries = () => {
  if (isCronRunning) {
    console.log("Free tries cron already running — skipping re-schedule");
    return;
  }

  isCronRunning = true;

  // Runs every day at 00:00 (midnight) IST
  cron.schedule(
    "0 0 * * *",
    async () => {
      console.log("[CRON] Resetting free tries...");

      try {
        const result = await Tries.updateMany(
          {},
          {
            $set: {
              freeTriesRemaining: 5,
              lastUpdated: new Date(),
            },
          }
        );

        console.log(
          `[CRON] Reset successful — updated ${result.modifiedCount} users.`
        );
      } catch (error) {
        console.error("[CRON] Error resetting free tries:", error.message);
      }
    },
    {
      timezone: "Asia/Kolkata",
    }
  );

  console.log("⏳ Free tries reset cron scheduled (midnight IST).");
};

export default resetFreeTries;
