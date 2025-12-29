// controllers/phonepeWebhookController.js
import crypto from "crypto";
import { applyPurchasedTries } from "./triesController.js";
import asyncHandler from "../middlewares/asyncHandler.js";
import Transaction from "../models/transactionModel.js";

export function verifyPhonePeWebhookAuth(req) {
    const authHeader = req.headers["authorization"];
    if (!authHeader) return false;

    const expectedHash = crypto
        .createHash("sha256")
        .update(
            `${process.env.PHONEPE_WEBHOOK_USERNAME}:${process.env.PHONEPE_WEBHOOK_PASSWORD}`, "utf8"
        )
        .digest("hex");

    return crypto.timingSafeEqual(
        Buffer.from(authHeader),
        Buffer.from(expectedHash)
    );
}


const phonepeWebhook = asyncHandler(async (req, res) => {

    // Verify Authorization header
    if (!verifyPhonePeWebhookAuth(req)) {
        console.warn("❌ Invalid PhonePe webhook authorization");
        return res.status(401).send("Unauthorized");
    }

    // Acknowledge receipt
    res.status(200).send("OK");

    try {
        // Extract Payload
        const { merchantOrderId, state } = req.body.payload || {};
        if (!merchantOrderId || !state) {
            console.warn("❌ PhonePe webhook missing data", req.body);
            return;
        }

        // Find and Update Transaction
        const txn = await Transaction.findOneAndUpdate(
            { merchantOrderId, fulfilled: false },
            { $set: { status: state } },
            { new: true }
        );
        if (!txn) {
            return;
        }

        // Credit user based on service type
        if (state === "COMPLETED") {
            switch (txn.service) {
                case "TRIES_PURCHASE":
                    await applyPurchasedTries(txn.userId, txn.triesToPurchase);
                    txn.fulfilled = true;
                    txn.status = "COMPLETED";
                    await txn.save();
                    break;

            }
        }
    } catch (error) {
        console.error("❌ PhonePe webhook processing error", error);
    }
});

export { phonepeWebhook };


// ----------------checked----------------