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
        return res.status(401).send("Unauthorized");
    }

    // Acknowledge immediately
    res.status(200).send("OK");

    try {
        // Extract Payload
        const payload = req.body.payload || {};
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
                        const paymentData = {
                          transaction_id: payload.paymentDetails.transactionId,
                          state: payload.paymentDetails.state,
                          payment_method: payload.paymentDetails.paymentMode,
                          amount_paid: payload.paymentDetails.amount
                        }
                        await markOrderAsPaid(merchantOrderId, paymentData);
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