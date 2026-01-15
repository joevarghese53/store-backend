import asyncHandler from "../middlewares/asyncHandler.js";
import Transaction from "../models/transactionModel.js";
import { getPhonePePaymentStatus } from "../utils/phonpeHelper.js";
import { applyPurchasedTries } from "./triesController.js";

const checkPaymentStatus = asyncHandler(async (req, res) => {

  console.log("Checking payment status for:", req.query);
  // Validate input
  const merchantOrderId = req.query.id;
  if (!merchantOrderId) {
    return res.status(400).json({ message: "Order ID required" });
  }

  // Find Transaction in DB
  const txn = await Transaction.findOne({ merchantOrderId });
  if (!txn) {
    return res.status(404).json({ message: "Transaction not found" });
  }

  // If already fulfilled, return immediately
  if (txn.fulfilled) {
    return res.json({ status: txn.status });
  }

  // Ask PhonePe for real status
  const statusRes = await getPhonePePaymentStatus(merchantOrderId);
  if (!statusRes?.state) {
    return res.json({ status: txn.status });
  }
  const normalizedStatus = statusRes.state === "COMPLETED" ? "SUCCESS" : statusRes.state.toUpperCase();

  // Fulfill ONLY if webhook hasn't already done it
  if (normalizedStatus === "SUCCESS") {
    const updated = await Transaction.findOneAndUpdate(
      { merchantOrderId, fulfilled: false },
      {
        status: "SUCCESS",
        fulfilled: true,
        fulfilledAt: new Date(),
      },
      { new: true }
    );

    if (updated && updated.service === "TRIES_PURCHASE") {
      await applyPurchasedTries(updated.userId, updated.triesToPurchase);
      console.log(`Applied ${updated.triesToPurchase} purchased tries to user ${updated.userId} after status check.`);
    }
  } else if (txn.status !== normalizedStatus) {
    await Transaction.updateOne(
      { merchantOrderId },
      { $set: { status: normalizedStatus } }
    );
  }

  return res.json({ status: normalizedStatus });
});

export { checkPaymentStatus };


// ------------- Checked -----------------