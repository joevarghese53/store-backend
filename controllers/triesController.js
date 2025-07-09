import Tries from "../models/triesModel.js";
import axios from "axios";
import crypto from "crypto";
import asyncHandler from "../middlewares/asyncHandler.js";
import redisClient from '../config/redisClient.js';

const getUserTries = async (req, res) => {
    const userId = req.user.id;

    try {
        const tries = await Tries.findOne({ user: userId });

        if (!tries) {
            return res.status(404).json({ message: "Tries not found" });
        }

        res.status(200).json({
            freeTriesRemaining: tries.freeTriesRemaining,
            purchasedTriesRemaining: tries.purchasedTriesRemaining,
        });
    } catch (error) {
        console.error("Error fetching user tries:", error);
        res.status(500).json({ message: "Server error" });
    }
};


const useTry = async (req, res) => {
    const userId = req.user.id;

    const tries = await Tries.findOne({ user: userId });

    if (!tries || (tries.freeTriesRemaining <= 0 && tries.purchasedTriesRemaining <= 0)) {
        return res.status(400).json({ message: "No tries remaining!" });
    }

    if (tries.freeTriesRemaining > 0) {
        tries.freeTriesRemaining -= 1;
    } else if (tries.purchasedTriesRemaining > 0) {
        tries.purchasedTriesRemaining -= 1;
    }

    await tries.save();

    res.status(200).json({
        message: "Try used successfully",
        freeTriesRemaining: tries.freeTriesRemaining,
        purchasedTriesRemaining: tries.purchasedTriesRemaining,
    });
};

const applyPurchasedTries = async (userId, triesToPurchase) => {
    const tries = await Tries.findOne({ user: userId });
    if (!tries) throw new Error("Tries not found");
    tries.purchasedTriesRemaining += Number(triesToPurchase);
    await tries.save();
    return tries.purchasedTriesRemaining;
};

const generateFeaturePaymentTransactionId = (userId, featureId) => {
    const timestamp = Date.now();
    const uid = userId.substring(0, 12);
    const fid = featureId.substring(0, 12);
    let id = `${uid}-${fid}-${timestamp}`;
    return id.length > 38 ? id.substring(0, 38) : id;
};


const initiatePayment = asyncHandler(async (req, res) => {
    const { featureId, amount, userId, name, triesToPurchase } = req.body;
    const transactionId = generateFeaturePaymentTransactionId(userId, featureId);

    const data = {
        merchantId: process.env.PHONEPE_MERCHANT_ID,
        merchantTransactionId: transactionId,
        merchantUserId: userId,
        amount,
        name,
        redirectUrl: `${process.env.BACKEND_URL}/api/tries/status?id=${transactionId}`,
        redirectMode: "POST",
        paymentInstrument: {
            type: "PAY_PAGE",
        },
    };

    // Store in Redis with expiry
    await redisClient.set(
        `txn:${transactionId}`,
        JSON.stringify({ userId, triesToPurchase }),
        { EX: 900 } // 15 minutes TTL
    );

    const payload = Buffer.from(JSON.stringify(data)).toString("base64");
    const string = payload + '/pg/v1/pay' + process.env.PHONEPE_SALT_KEY;
    const sha256 = crypto.createHash('sha256').update(string).digest('hex');
    const checksum = sha256 + "###" + process.env.PHONEPE_SALT_INDEX;

    const options = {
        method: 'POST',
        url: "https://api-preprod.phonepe.com/apis/pg-sandbox/pg/v1/pay",
        headers: {
            accept: 'application/json',
            'Content-Type': 'application/json',
            'X-VERIFY': checksum
        },
        data: { request: payload }
    };

    try {
        const response = await axios(options);
        return res.json({
            success: true,
            data: response.data.data
        });
    } catch (error) {
        console.error("Error initiating payment:", error.message);
        res.status(500).json({ success: false, message: "Payment initiation failed" });
    }
});

const checkPaymentStatus = asyncHandler(async (req, res) => {
    const transactionId = req.query.id;
    const retryCount = parseInt(req.query.retry || '0', 10);
    const merchantId = process.env.PHONEPE_MERCHANT_ID;

    const string = `/pg/v1/status/${merchantId}/${transactionId}` + process.env.PHONEPE_SALT_KEY;
    const sha256 = crypto.createHash('sha256').update(string).digest('hex');
    const checksum = sha256 + "###" + process.env.PHONEPE_SALT_INDEX;

    const options = {
        method: 'GET',
        url: `https://api-preprod.phonepe.com/apis/pg-sandbox/pg/v1/status/${merchantId}/${transactionId}`,
        headers: {
            accept: 'application/json',
            'Content-Type': 'application/json',
            'X-VERIFY': checksum,
            'X-MERCHANT-ID': merchantId,
        },
    };

    try {
        const response = await axios(options);
        const code = response.data.code;

        switch (code) {
            case 'PAYMENT_SUCCESS': {
                const tempData = await redisClient.get(`txn:${transactionId}`);
                console.log("Payment success data:", tempData);
                if (!tempData) throw new Error("Redis temp data missing");

                const { userId, triesToPurchase } = JSON.parse(tempData);

                await applyPurchasedTries(userId, triesToPurchase);
                await redisClient.del(`txn:${transactionId}`);

                return res.redirect(`${process.env.FRONTEND_URL}/Customs`);
            }

            case 'PAYMENT_PENDING':
            case 'INTERNAL_SERVER_ERROR':
                if (retryCount < 3) {
                    return res.redirect(`${process.env.BACKEND_URL}/api/tries/status?id=${transactionId}&retry=${retryCount + 1}`);
                } else {
                    return res.redirect(`${process.env.FRONTEND_URL}/PaymentFailedPage?id=${transactionId}&message=Timeout`);
                }

            default:
                return res.redirect(`${process.env.FRONTEND_URL}/PaymentFailedPage?id=${transactionId}&message=${encodeURIComponent(code)}`);
        }
    } catch (error) {
        console.error("Payment status error:", error.message);
        return res.redirect(`${process.env.FRONTEND_URL}/PaymentFailedPage?id=${transactionId}&message=ServerError`);
    }
});

export {
    getUserTries,
    useTry,
    applyPurchasedTries,
    initiatePayment,
    checkPaymentStatus,
};