// controllers/paymentController.js
import { applyPurchasedTries } from "./triesController.js";
import asyncHandler from "../middlewares/asyncHandler.js";
import Transaction from "../models/transactionModel.js";
import { getPhonePePaymentStatus } from "../utils/phonpeHelper.js";

// @desc    PhonePe redirect handler for tries purchase
// @route   GET /api/tries/status?id=transactionId
// @access  Public (called via redirect)
const checkPaymentStatus = asyncHandler(async (req, res) => {
  const merchantOrderId = req.query.id;
  
  const txn = await Transaction.findOne({ merchantOrderId });
  if (!txn) {
    return res.status(404).send("Transaction not found");
  }
  if (txn.fulfilled) {
    return res.json({ status: txn.status });
  }

  const statusRes = await getPhonePePaymentStatus(merchantOrderId);
  const state = statusRes.data.state;

  if (state === "COMPLETED" && !txn.fulfilled) {
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
  res.json({ status: txn.status });
});

export {
    checkPaymentStatus
}