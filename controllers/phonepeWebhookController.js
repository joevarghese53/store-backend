// controllers/phonepeWebhookController.js
import crypto from "crypto";
import { applyPurchasedTries } from "./triesController.js";
import asyncHandler from "../middlewares/asyncHandler.js";
import Transaction from "../models/transactionModel.js";
import { markOrderAsPaid } from "./orderController.js";

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
    console.log("Inside Webhook");
    // Verify Authorization header
    if (!verifyPhonePeWebhookAuth(req)) {
        return res.status(401).send("Unauthorized");
    }

    // Acknowledge immediately
    res.status(200).send("OK");

    try {
        // Extract Payload
        const payload = req.body.payload || {};
        console.log("Webhook payload received:", payload);
        const { merchantOrderId, state } = payload

        if (!merchantOrderId || !state) {
            return;
        }
        const normalizedState = state === "COMPLETED" ? "SUCCESS" : state.toUpperCase();

        // Find and Update Transaction
        const txn = await Transaction.findOneAndUpdate(
            {
                merchantOrderId,
                fulfilled: false,
                status: { $ne: "SUCCESS" },
            },
            {
                status: normalizedState,
                fulfilled: normalizedState === "SUCCESS",
                fulfilledAt: normalizedState === "SUCCESS" ? new Date() : undefined,
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
                    break;

                    case "PRODUCT_PURCHASE":
                        const orderId = merchantOrderId.split("_")[1];
                        const paymentDetails = payload.paymentDetails[0]
                        const paymentData = {
                          transactionId: paymentDetails.transactionId,
                          state: paymentDetails.state,
                          paymentMode: paymentDetails.paymentMode,
                          amount: paymentDetails.amount
                        }
                        console.log("Marking order as paid for Order ID:", orderId, paymentData);
                        await markOrderAsPaid(orderId, paymentData);
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