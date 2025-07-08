import axios from "axios";
import crypto from "crypto";
import asyncHandler from "../middlewares/asyncHandler.js";
import { markOrderAsPaid } from "./orderController.js";

// Initiate Payment
const initiatePayment = asyncHandler(async (req, res) => {
  try {
    const {
      merchantTransactionId,
      customerUserId,
      amount,
      name,
    } = req.body;

    const merchantId = process.env.PHONEPE_MERCHANT_ID;
    const redirectUrl = `${process.env.BACKEND_URL}/api/payment/status?id=${merchantTransactionId}`;

    const data = {
      merchantId,
      merchantTransactionId,
      merchantUserId: customerUserId,
      amount,
      name,
      redirectUrl,
      redirectMode: "POST",
      paymentInstrument: {
        type: "PAY_PAGE",
      },
    };

    const payload = JSON.stringify(data);
    const payloadMain = Buffer.from(payload).toString("base64");
    const string = payloadMain + "/pg/v1/pay" + process.env.PHONEPE_SALT_KEY;
    const sha256 = crypto.createHash("sha256").update(string).digest("hex");
    const checksum = sha256 + "###" + process.env.PHONEPE_SALT_INDEX;

    const url = `${process.env.PHONEPE_API_BASE_URL}/pg/v1/pay`;

    const options = {
      method: "POST",
      url,
      headers: {
        accept: "application/json",
        "Content-Type": "application/json",
        "X-VERIFY": checksum,
      },
      data: {
        request: payloadMain,
      },
    };

    const response = await axios(options);
    return res.json(response.data);
  } catch (error) {
    console.error("Initiate payment error:", error.message);
    return res.status(500).json({ success: false, message: "Payment initiation failed" });
  }
});

// Check Payment Status
const checkPaymentStatus = asyncHandler(async (req, res) => {
  try {
    const merchantTransactionId = req.query.id;
    const retryCount = parseInt(req.query.retry || '0', 10);
    const merchantId = process.env.PHONEPE_MERCHANT_ID;

    const string = `/pg/v1/status/${merchantId}/${merchantTransactionId}` + process.env.PHONEPE_SALT_KEY;
    const sha256 = crypto.createHash("sha256").update(string).digest("hex");
    const checksum = sha256 + "###" + process.env.PHONEPE_SALT_INDEX;

    const url = `${process.env.PHONEPE_API_BASE_URL}/pg/v1/status/${merchantId}/${merchantTransactionId}`;

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

    const response = await axios.request(options);
    const code = response.data.code;
    const orderId = merchantTransactionId;

    switch (code) {
      case "PAYMENT_SUCCESS":
        try {
          const paymentData = {
            transaction_id: response.data.data.transactionId,
            order_id: response.data.data.merchantTransactionId,
            status: response.data.code,
            state: response.data.data.state,
            update_time: new Date().toISOString(),
            payment_method: response.data.data.paymentInstrument.type,
            amount_paid: response.data.data.amount / 100,
          };

          await markOrderAsPaid(orderId, paymentData);

          const successUrl = `${process.env.FRONTEND_URL}/PaymentSuccessPage?id=${orderId}`;
          return res.redirect(successUrl);
        } catch (error) {
          console.error("Error updating payment status:", error.message);
          const failUrl = `${process.env.FRONTEND_URL}/PaymentFailedPage?id=${orderId}`;
          return res.redirect(failUrl);
        }

      case "PAYMENT_PENDING":
      case "INTERNAL_SERVER_ERROR":
        if (retryCount < 3) {
          console.log(`${code} - Retrying (${retryCount + 1}/3)...`);
          const retryUrl = `${req.baseUrl}${req.path}?id=${orderId}&retry=${retryCount + 1}`;
          return res.redirect(retryUrl); // frontend can trigger retry delay
        } else {
          const timeoutUrl = `${process.env.FRONTEND_URL}/PaymentFailedPage?id=${orderId}&message=Retries%20Exceeded`;
          return res.redirect(timeoutUrl);
        }

      case "BAD_REQUEST":
      case "AUTHORIZATION_FAILED":
      case "PAYMENT_ERROR":
      case "TRANSACTION_NOT_FOUND":
      case "PAYMENT_DECLINED":
      case "TIMED_OUT":
        const errorMessage = encodeURIComponent(`Error: ${code}`);
        const errorUrl = `${process.env.FRONTEND_URL}/PaymentFailedPage?message=${errorMessage}&id=${orderId}`;
        return res.redirect(errorUrl);

      default:
        console.warn("Unhandled status code:", code);
        const unhandledUrl = `${process.env.FRONTEND_URL}/PaymentFailedPage?message=Unhandled%20Response&id=${orderId}`;
        return res.redirect(unhandledUrl);
    }
  } catch (error) {
    console.error("Error checking payment status:", error.message);
    const fallbackUrl = `${process.env.FRONTEND_URL}/PaymentFailedPage?id=${req.query.id}`;
    return res.redirect(fallbackUrl);
  }
});

export {
  initiatePayment,
  checkPaymentStatus,
};
