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

    console.log("Auth Header:", authHeader);
    console.log("Expected Hash:", expectedHash);

    return crypto.timingSafeEqual(
        Buffer.from(authHeader),
        Buffer.from(expectedHash)
    );
}


const phonepeWebhook = asyncHandler(async (req, res) => {

    console.log("Received PhonePe Webhook:", req.body);

    // Verify Authorization header
    if (!verifyPhonePeWebhookAuth(req)) {
        return res.status(401).send("Unauthorized");
    }

    // Acknowledge immediately
    res.status(200).send("OK");

    try {
        // Extract Payload
        const { merchantOrderId, state } = req.body.payload || {};
        if (!merchantOrderId || !state) {
            return;
        }

        // Find and Update Transaction
        const txn = await Transaction.findOneAndUpdate(
            {
                merchantOrderId,
                fulfilled: false,
                status: { $ne: "SUCCESS" },
            },
            {
                status: state === "COMPLETED" ? "SUCCESS" : state.toUpperCase(),
                fulfilled: state === "COMPLETED",
                fulfilledAt: state === "COMPLETED" ? new Date() : undefined,
            },
            { new: true }
        );
        if (!txn) {
            return
        }

        // Credit user based on service type
        if (txn.status === "SUCCESS") {
            switch (txn.service) {
                case "TRIES_PURCHASE":
                    await applyPurchasedTries(txn.userId, txn.triesToPurchase);
                    console.log(`Applied ${txn.triesToPurchase} purchased tries to user ${txn.userId} from webhook.`);
                    break;
            }
        }

        return 
    } catch (error) {
        console.error("❌ PhonePe webhook error", error);
        return
    }
});

export { phonepeWebhook };


// ----------------checked----------------