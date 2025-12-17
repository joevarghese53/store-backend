import Tries from "../models/triesModel.js";
import axios from "axios";
import crypto from "crypto";
import asyncHandler from "../middlewares/asyncHandler.js";
import { redisClient } from "../config/redisClient.js";

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

const generateFeaturePaymentTransactionId = (userId, featureId) => {
  const timestamp = Date.now();
  const uid = userId.toString().substring(0, 12);
  const fid = featureId.toString().substring(0, 12);
  let id = `${uid}-${fid}-${timestamp}`;
  return id.length > 38 ? id.substring(0, 38) : id;
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
  const { featureId, amount, userId, name, triesToPurchase } = req.body;

  if (!featureId || !amount || !userId || !name || !triesToPurchase) {
    res.status(400);
    throw new Error("featureId, amount, userId, name and triesToPurchase are required");
  }

  const transactionId = generateFeaturePaymentTransactionId(userId, featureId);

  // Store purchase info in Redis for later retrieval
  await redisClient.set(
    `txn:${transactionId}`,
    JSON.stringify({ userId, triesToPurchase }),
    { EX: 900 } // 15 minutes TTL
  );

  const data = {
    merchantId: process.env.PHONEPE_MERCHANT_ID,
    merchantTransactionId: transactionId,
    merchantUserId: userId,
    amount, // in paise
    name,
    redirectUrl: `${process.env.BACKEND_URL}/api/tries/status?id=${transactionId}`,
    redirectMode: "POST",
    paymentInstrument: {
      type: "PAY_PAGE",
    },
  };

  const payload = Buffer.from(JSON.stringify(data)).toString("base64");
  const stringToSign = payload + "/pg/v1/pay" + process.env.PHONEPE_SALT_KEY;
  const sha256 = crypto.createHash("sha256").update(stringToSign).digest("hex");
  const checksum = `${sha256}###${process.env.PHONEPE_SALT_INDEX}`;

  const url = `${process.env.PHONEPE_API_BASE_URL}/pg/v1/pay`; // use env base URL

  const options = {
    method: "POST",
    url,
    headers: {
      accept: "application/json",
      "Content-Type": "application/json",
      "X-VERIFY": checksum,
    },
    data: { request: payload },
  };

  const response = await axios(options);

  res.json({
    success: true,
    data: response.data.data,
  });
});

// @desc    PhonePe redirect handler for tries purchase
// @route   GET /api/tries/status?id=transactionId
// @access  Public (called via redirect)
const checkPaymentStatus = asyncHandler(async (req, res) => {
  const transactionId = req.query.id;
  const retryCount = parseInt(req.query.retry || "0", 10);
  const merchantId = process.env.PHONEPE_MERCHANT_ID;

  if (!transactionId) {
    res.status(400);
    throw new Error("Missing transaction id");
  }

  const stringToSign =
    `/pg/v1/status/${merchantId}/${transactionId}` +
    process.env.PHONEPE_SALT_KEY;

  const sha256 = crypto.createHash("sha256").update(stringToSign).digest("hex");
  const checksum = `${sha256}###${process.env.PHONEPE_SALT_INDEX}`;

  const url = `${process.env.PHONEPE_API_BASE_URL}/pg/v1/status/${merchantId}/${transactionId}`;

  const options = {
    method: "GET",
    url,
    headers: {
      accept: "application/json",
      "Content-Type": "application/json",
      "X-VERIFY": checksum,
      "X-MERCHANT-ID": merchantId,
    },
  };

  try {
    const response = await axios(options);
    const code = response.data.code;

    switch (code) {
      case "PAYMENT_SUCCESS": {
        const tempData = await redisClient.get(`txn:${transactionId}`);
        console.log("Payment success temp data:", tempData);

        if (!tempData) {
          throw new Error("Redis temp data missing for this transaction");
        }

        const { userId, triesToPurchase } = JSON.parse(tempData);

        await applyPurchasedTries(userId, triesToPurchase);
        await redisClient.del(`txn:${transactionId}`);

        return res.redirect(`${process.env.FRONTEND_URL}/Customs`);
      }

      case "PAYMENT_PENDING":
      case "INTERNAL_SERVER_ERROR": {
        if (retryCount < 3) {
          const retryUrl = `${process.env.BACKEND_URL}/api/tries/status?id=${transactionId}&retry=${
            retryCount + 1
          }`;
          return res.redirect(retryUrl);
        }
        return res.redirect(
          `${process.env.FRONTEND_URL}/PaymentFailedPage?id=${transactionId}&message=Timeout`
        );
      }

      default: {
        const msg = encodeURIComponent(code);
        return res.redirect(
          `${process.env.FRONTEND_URL}/PaymentFailedPage?id=${transactionId}&message=${msg}`
        );
      }
    }
  } catch (error) {
    console.error("Payment status error:", error.message);
    return res.redirect(
      `${process.env.FRONTEND_URL}/PaymentFailedPage?id=${transactionId}&message=ServerError`
    );
  }
});

export {
  getUserTries,
  useTry,
  applyPurchasedTries, // service, used internally / tests
  initiatePayment,
  checkPaymentStatus,
};
