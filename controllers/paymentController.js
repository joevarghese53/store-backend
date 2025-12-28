import asyncHandler from "../middlewares/asyncHandler.js";
import Transaction from "../models/transactionModel.js";
import { getPhonePePaymentStatus } from "../utils/phonpeHelper.js";
import { applyPurchasedTries } from "./triesController.js";

const checkPaymentStatus = asyncHandler(async (req, res) => {
  const merchantOrderId = req.query.id;

  if (!merchantOrderId) {
    return res.status(400).json({ message: "Order ID required" });
  }

  const txn = await Transaction.findOne({ merchantOrderId });
  if (!txn) {
    return res.status(404).json({ message: "Transaction not found" });
  }

  // If already fulfilled, return immediately
  if (txn.fulfilled) {
    return res.json({ status: txn.status });
  }

  console.log("Checking PhonePe payment status for:", merchantOrderId); 
  // Ask PhonePe for real status
  const statusRes = await getPhonePePaymentStatus(merchantOrderId);

  if (!statusRes?.state) {
    return res.json({ status: txn.status });
  }

  const { state, amount } = statusRes;

  // Only proceed if payment actually succeeded
  if (state === "COMPLETED" && amount === txn.amount) {

    // 🔒 ATOMIC fulfillment
    const fulfilledTxn = await Transaction.findOneAndUpdate(
      { merchantOrderId, fulfilled: false },
      { $set: { fulfilled: true, status: "COMPLETED" } },
      { new: true }
    );

    console.log("Updated DB from CheckPaymentStatus")

    // Only one request will enter here
    if (fulfilledTxn) {
      switch (fulfilledTxn.service) {
        case "TRIES_PURCHASE":
          await applyPurchasedTries(
            fulfilledTxn.userId,
            fulfilledTxn.triesToPurchase
          );
          break;
      }
    }

    return res.json({ status: "COMPLETED" });
  }

  // Update non-success states
  await Transaction.updateOne(
    { merchantOrderId },
    { $set: { status: state } }
  );

  return res.json({ status: state });
});

export { checkPaymentStatus };
