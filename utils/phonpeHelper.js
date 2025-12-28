// utils/phonepeHelper.js
import axios from "axios";

/**
 * Simple in-memory token cache
 * PhonePe OAuth tokens are reusable until expiry
 */
let cachedToken = null;
let tokenExpiryTime = 0;

/**
 * Get PhonePe OAuth Token (cached + safe)
 */
export async function getPhonePeAuthToken() {
  const now = Date.now();

  // Reuse token if valid (keep 5 min buffer)
  if (cachedToken && now < tokenExpiryTime - 5 * 60 * 1000) {
    return cachedToken;
  }

  try {
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

    cachedToken = res.data.access_token;
    tokenExpiryTime = now + res.data.expires_in * 1000;

    return cachedToken;
  } catch (error) {
    console.error(
      "PhonePe Auth Error:",
      error.response?.data || error.message
    );
    throw new Error("Failed to authenticate with PhonePe");
  }
}

/**
 * Initiate PhonePe Standard Checkout payment
 */
export async function initiatePhonePePayment(merchantOrderId, amount) {
  try {
    const accessToken = await getPhonePeAuthToken();

    const paymentData = {
      merchantOrderId,
      amount, // in paise
      paymentFlow: {
        type: "PG_CHECKOUT",
        merchantUrls: {
          redirectUrl: `${process.env.BACKEND_URL}/api/payment/status?id=${merchantOrderId}`,
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

/**
 * Fetch payment status from PhonePe
 */
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
      "PhonePe Status Check Error:",
      error.response?.data || error.message
    );
    throw new Error("Unable to fetch PhonePe payment status");
  }
}
