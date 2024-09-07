import axios from "axios";
import crypto from "crypto";
import asyncHandler from "../middlewares/asyncHandler.js";
import { markOrderAsPaid } from "./orderController.js";

const initiatePayment = asyncHandler(async (req, res) => {
    try {
        console.log("Initiate Payment");
        console.log(req.body);

        const merchantTransaction_Id = req.body.merchantTransactionId; 
        const data = {
            merchantId: process.env.PHONEPE_MERCHANT_ID,
            merchantTransactionId: merchantTransaction_Id,
            merchantUserId: req.body.customerUserId,
            amount: req.body.amount,
            name: req.body.name,
            redirectUrl: `https://store-backend-2r39.onrender.com/api/payment/status?id=${merchantTransaction_Id}`,
            redirectMode: "POST",
            paymentInstrument: {
                type: "PAY_PAGE",
            },
        };

        const payload = JSON.stringify(data);
        const payloadMain = Buffer.from(payload).toString("base64");
        const string = payloadMain + '/pg/v1/pay' + process.env.PHONEPE_SALT_KEY;
        const sha256 = crypto.createHash('sha256').update(string).digest('hex');
        const checksum = sha256 + "###" + process.env.PHONEPE_SALT_INDEX;

        // const prod_url = "https://api.phonepe.com/apis/hermes/pg/v1/pay"; 
        const prod_url = "https://api-preprod.phonepe.com/apis/pg-sandbox/pg/v1/pay";
        const options = {
            method: 'POST',
            url: prod_url,
            headers: {
                accept: 'application/json',
                'Content-Type': 'application/json',
                'X-VERIFY': checksum
            },
            data: {
                request: payloadMain
            }
        };

        await axios(options).then(function (response) {
            console.log(response.data);
            return res.json(response.data);
        }
        ).catch(function (error) {
            console.log(error);
        });



    } catch (error) {
        console.log(error)
    }
});

const checkPaymentStatus = asyncHandler(async (req, res) => {
    try {
        console.log("Checking Payment Status.......");
        const merchantTransactionId = req.query.id;
        const merchantId = process.env.PHONEPE_MERCHANT_ID;
        console.log(merchantTransactionId);
        const string = `/pg/v1/status/${merchantId}/${merchantTransactionId}` + process.env.PHONEPE_SALT_KEY;
        const sha256 = crypto.createHash('sha256').update(string).digest('hex');
        const checksum = sha256 + "###" + process.env.PHONEPE_SALT_INDEX;
        console.log(checksum);

        const options = {
            method: 'GET',
            url: `https://api-preprod.phonepe.com/apis/pg-sandbox/pg/v1/status/${merchantId}/${merchantTransactionId}`,
            headers: {
                accept: 'application/json',
                'Content-Type': 'application/json',
                'X-VERIFY': checksum,
                'X-MERCHANT-ID': `${merchantId}`,
            }
        };

        try {
            const response = await axios.request(options);
            const code = response.data.code;
            console.log("Response Code:", code);
            const orderId = merchantTransactionId;

            switch (code) {
                case 'PAYMENT_SUCCESS':
                    console.log("Payment successful");
                    try {
                        console.log("response: ",response.data);
                        const paymentData = {
                            transaction_id: response.data.data.transactionId,
                            order_id: response.data.data.merchantTransactionId,
                            status: response.data.code,
                            state: response.data.data.state,
                            update_time: new Date(Date.now()).toISOString(),
                            payment_method: response.data.data.paymentInstrument.type,
                            amount_paid: response.data.data.amount / 100,
                        };

                        console.log("paymentData:", paymentData);

                        await markOrderAsPaid(orderId, paymentData);

                        const url = `https://store-frontend-taupe.vercel.app/PaymentSuccessPage?id=${orderId}`;
                        return res.redirect(url);
                    } catch (error) {
                        console.log("Error updating order payment status:", error.message);
                        const url = `https://store-frontend-taupe.vercel.app/PaymentFailedPage?id=${orderId}`;
                        return res.redirect(url);
                    }

                case 'PAYMENT_PENDING':
                case 'INTERNAL_SERVER_ERROR':
                    console.log(`${code} encountered. Retrying...`);
                    // Implement a retry mechanism with a maximum retry count
                    setTimeout(() => {
                        checkPaymentStatus(req, res); // Ensure this does not cause infinite recursion
                    }, 30000); // Retry after 30 seconds
                    break;

                case 'BAD_REQUEST':
                case 'AUTHORIZATION_FAILED':
                case 'PAYMENT_ERROR':
                case 'TRANSACTION_NOT_FOUND':
                case 'PAYMENT_DECLINED':
                case 'TIMED_OUT':
                    console.log(`${code} - Redirecting to PaymentFailedPage`);
                    const errorMessage = encodeURIComponent(`Error: ${code}`);
                    const errorUrl = `https://store-frontend-taupe.vercel.app/PaymentFailedPage?message=${errorMessage}&id=${orderId}`;
                    return res.redirect(errorUrl);

                default:
                    console.log("Unhandled response code:", code);
                    const unhandledUrl = `https://store-frontend-taupe.vercel.app/PaymentFailedPage?message=Unhandled%20Response&id=${orderId}`;
                    return res.redirect(unhandledUrl);
            }
        } catch (error) {
            console.log("Error with payment request:", error.message);
            const orderId = req.query.id; // Ensure orderId is retrieved if possible
            const url = `https://store-frontend-taupe.vercel.app/PaymentFailedPage?id=${orderId}`;
            return res.redirect(url);
        }

    } catch (error) {
        console.log(error);
        const orderId = req.query.id; // Ensure orderId is retrieved if possible
        const url = `https://store-frontend-taupe.vercel.app/PaymentFailedPage?id=${orderId}`;
        return res.redirect(url);
    }
});





export {
    initiatePayment,
    checkPaymentStatus,
};
