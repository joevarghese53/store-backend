import asyncHandler from "../middlewares/asyncHandler.js";
import Transaction from "../models/transactionModel.js";
import { getPhonePePaymentStatus } from "../utils/phonpeHelper.js";

const checkPaymentStatus = asyncHandler(async (req, res) => {
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
  const { state } = statusRes;

  // Update Transaction status in DB
  if (txn.status !== "COMPLETED") {
    await Transaction.updateOne(
      { merchantOrderId },
      { $set: { status: state } }
    );
  }

  return res.json({ status: state });
});

export { checkPaymentStatus };


// ------------- Checked -----------------