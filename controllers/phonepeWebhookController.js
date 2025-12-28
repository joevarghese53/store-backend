// controllers/phonepeWebhookController.js
import crypto from "crypto";
import { applyPurchasedTries } from "./triesController.js";
import asyncHandler from "../middlewares/asyncHandler.js";
import Transaction from "../models/transactionModel.js";

export function verifyPhonePeWebhookAuth(req) {
    const authHeader = req.headers["authorization"];

    if (!authHeader) {
        return false;
    }

    const expectedHash = crypto
        .createHash("sha256")
        .update(
            `${process.env.PHONEPE_WEBHOOK_USERNAME}:${process.env.PHONEPE_WEBHOOK_PASSWORD}`
        )
        .digest("hex");

    return authHeader === `SHA256(${expectedHash})` || authHeader === expectedHash;
}

const phonepeWebhook = asyncHandler(async (req, res) => {

    console.log("PhonePe Webhook received:", req.body);

    // Verify Authorization header
    if (!verifyPhonePeWebhookAuth(req)) {
        console.warn("❌ Invalid PhonePe webhook authorization");
        return res.status(401).send("Unauthorized");
    }

    // Extract Payload
    const { merchantOrderId, state } = req.body.payload;
    if (!merchantOrderId || !state) {
        return res.status(400).send("Invalid payload");
    }

    // Find and Update Transaction
    const txn = await Transaction.findOne({ merchantOrderId });
    if (!txn) {
        return res.status(200).send("OK"); // don't retry
    }
    if (txn.fulfilled) {
        return res.status(200).send("OK");
    }
    if (state === "COMPLETED") {
        switch (txn.service) {
            case "TRIES_PURCHASE":
                await applyPurchasedTries(txn.userId, txn.triesToPurchase);
                txn.fulfilled = true;
                await txn.save();
                break;
            // Add more services as needed

        }

    }
    txn.status = state;
    await txn.save();
    res.status(200).send("OK");
});

export { phonepeWebhook };