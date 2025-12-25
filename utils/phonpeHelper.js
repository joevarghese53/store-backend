// utils/phonpeHelper.js
import axios from "axios";

export async function getPhonePeAuthToken() {
    const data = new URLSearchParams();
    data.append("grant_type", process.env.PHONEPE_GRANT_TYPE);
    data.append("client_id", process.env.PHONEPE_CLIENT_ID);
    data.append("client_secret", process.env.PHONEPE_CLIENT_SECRET);
    data.append("client_version", process.env.PHONEPE_CLIENT_VERSION);
    const res = await axios.post(
        process.env.PHONEPE_AUTH_URL,
        data,
        {
            headers: { "Content-Type": "application/x-www-form-urlencoded" },
        }
    );
    return res.data.access_token;
}

export async function initiatePhonePePayment(merchantOrderId, amount) {

    const access_token = await getPhonePeAuthToken();

    const paymentData = {
        merchantOrderId,
        amount,
        "paymentFlow": {
            "type": "PG_CHECKOUT",
            "message": "Payment message used for collect requests",
            "merchantUrls": {
                redirectUrl: `${process.env.FRONTEND_URL}/phonepeCallback?orderId=${merchantOrderId}`,
            }
        },
    };

    const paymentRes = await axios.post(
        `${process.env.PHONEPE_PAY_URL}`,
        paymentData,
        {
            headers: {
                Authorization: `O-Bearer ${access_token}`,
                "Content-Type": "application/json",
            },
        }
    );

    return paymentRes.data;
}

export async function getPhonePePaymentStatus(merchantOrderId) {
    
    const access_token = await getPhonePeAuthToken();

    const statusRes = await axios.get(
        `${process.env.PHONEPE_STATUS_URL}/${merchantOrderId}/status`,
        {
            headers: {
                Authorization: `O-Bearer ${access_token}`,
            },
        }
    );

    return statusRes.data;
}