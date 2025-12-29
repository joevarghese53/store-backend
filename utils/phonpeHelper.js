// utils/phonepeHelper.js
import axios from "axios";
import { redisClient } from '../config/redisClient.js';

const PHONEPE_TOKEN_KEY = "phonepe:oauth:token";
const EXPIRY_BUFFER_SECONDS = 300; // 5 min safety buffer

export async function getPhonePeAuthToken() {
  try {
    // Check Redis cache
    if (redisClient?.isOpen) {
      const cachedToken = await redisClient.get(PHONEPE_TOKEN_KEY);
      if (cachedToken) {
        return cachedToken;
      }
    }

    // Fetch new token from PhonePe
    const data = new URLSearchParams();
    data.append("grant_type", process.env.PHONEPE_GRANT_TYPE);
    data.append("client_id", process.env.PHONEPE_CLIENT_ID);
    data.append("client_secret", process.env.PHONEPE_CLIENT_SECRET);
    data.append("client_version", process.env.PHONEPE_CLIENT_VERSION);

    const res = await axios.post(
      process.env.PHONEPE_AUTH_URL,
      data,
      {
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
        timeout: 5000,
      }
    );

    const { access_token, expires_in } = res.data || {};

    if (!access_token || !expires_in) {
      throw new Error("Invalid PhonePe auth response");
    }

    // Store token in Redis with TTL
    if (redisClient?.isOpen) {
      const ttl = Math.max(expires_in - EXPIRY_BUFFER_SECONDS, 60);

      await redisClient.set(
        PHONEPE_TOKEN_KEY,
        access_token,
        { EX: ttl }
      );
    }

    return access_token;

  } catch (error) {
    console.error("❌ PhonePe Auth Error", {
      error: error.response?.data || error.message,
    });
    throw new Error("Failed to authenticate with PhonePe");
  }
}

export async function initiatePhonePePayment(merchantOrderId, amount) {
  try {
    const accessToken = await getPhonePeAuthToken();

    const paymentData = {
      merchantOrderId,
      amount,
      paymentFlow: {
        type: "PG_CHECKOUT",
        merchantUrls: {
          redirectUrl: `${process.env.FRONTEND_URL}?id=${merchantOrderId}`, //Not used because of iframe mode of payment in frontend
        },
      },
    };

    const res = await axios.post(
      process.env.PHONEPE_PAY_URL,
      paymentData,
      {
        headers: {
          Authorization: `O-Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        timeout: 8000,
      }
    );

    return res.data;
  } catch (error) {
    console.error(
      "PhonePe Initiate Payment Error:",
      error.response?.data || error.message
    );
    throw new Error("Unable to initiate PhonePe payment");
  }
}

export async function getPhonePePaymentStatus(merchantOrderId) {
  try {
    const accessToken = await getPhonePeAuthToken();

    const res = await axios.get(
      `${process.env.PHONEPE_STATUS_URL}/${merchantOrderId}/status`,
      {
        headers: {
          Authorization: `O-Bearer ${accessToken}`,
        },
        timeout: 5000,
      }
    );

    return res.data;
  } catch (error) {
    console.error(
      "PhonePe Status Check Error:",{
        merchantOrderId,
        error: error.response?.data || error.message
      }
    );
    throw new Error("Unable to fetch PhonePe payment status");
  }
}


// ----------------checked----------------