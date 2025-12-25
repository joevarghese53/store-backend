import Tries from "../models/triesModel.js";
import asyncHandler from "../middlewares/asyncHandler.js";
import Transaction from "../models/transactionModel.js";
import { initiatePhonePePayment } from "../utils/phonpeHelper.js";

// ---------- Core Helpers ----------

const applyPurchasedTries = async (userId, triesToPurchase) => {
  const tries = await Tries.findOne({ user: userId });
  if (!tries) {
    throw new Error("Tries not found");
  }

  tries.purchasedTriesRemaining += Number(triesToPurchase);
  await tries.save();
  return tries.purchasedTriesRemaining;
};

// ---------- Controllers ----------

// @desc    Get current user's tries
// @route   GET /api/tries
// @access  Private
const getUserTries = asyncHandler(async (req, res) => {
  const userId = req.user._id;

  const tries = await Tries.findOne({ user: userId });

  if (!tries) {
    res.status(404);
    throw new Error("Not found");
  }

  res.status(200).json({
    freeTriesRemaining: tries.freeTriesRemaining,
    purchasedTriesRemaining: tries.purchasedTriesRemaining,
  });
});

// @desc    Use a try (free first, then purchased)
// @route   PUT /api/tries/use
// @access  Private
const useTry = asyncHandler(async (req, res) => {
  const userId = req.user._id;

  const tries = await Tries.findOne({ user: userId });

  if (!tries || (tries.freeTriesRemaining <= 0 && tries.purchasedTriesRemaining <= 0)) {
    res.status(400);
    throw new Error("No tries remaining!");
  }

  if (tries.freeTriesRemaining > 0) {
    tries.freeTriesRemaining -= 1;
  } else {
    tries.purchasedTriesRemaining -= 1;
  }

  await tries.save();

  res.status(200).json({
    message: "Try used successfully",
    freeTriesRemaining: tries.freeTriesRemaining,
    purchasedTriesRemaining: tries.purchasedTriesRemaining,
  });
});

// @desc    Initiate PhonePe payment for tries purchase
// @route   POST /api/tries/purchase-tries
// @access  Private
const initiatePayment = asyncHandler(async (req, res) => {
  // Validate request body
  const { featureId, amount, userId, name, triesToPurchase } = req.body;
  if (!featureId || !amount || !userId || !name || !triesToPurchase) {
    res.status(400);
    throw new Error("featureId, amount, userId, name and triesToPurchase are required");
  }

  // Add Txn to DB
  const merchantOrderId = `${featureId}_${userId}_${Date.now()}`;
  console.log("Generated Merchant Order ID:", merchantOrderId);
  await Transaction.create({
    merchantOrderId,
    userId,
    service: "TRIES_PURCHASE",
    serviceRef: featureId,
    triesToPurchase,
    amount,
    status: "INITIATED",
    fulfilled: false,
  });

  // Initiate Payment
  const response = await initiatePhonePePayment(merchantOrderId, amount);

  res.json({
    success: true,
    redirectUrl: response.redirectUrl,
  });
});


export {
  getUserTries,
  useTry,
  applyPurchasedTries,
  initiatePayment,
};
