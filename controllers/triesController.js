import Tries from "../models/triesModel.js";
import axios from "axios";
import crypto from "crypto";
import asyncHandler from "../middlewares/asyncHandler.js";

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

  const purchaseTries = async (triesToPurchase, userId) => {
  
    const tries = await Tries.findOne({ user: userId });
  
    if (!tries) {
      return res.status(404).json({ message: "Tries not found!" });
    }
  
    tries.purchasedTriesRemaining = Number(tries.purchasedTriesRemaining) + Number(triesToPurchase);
    await tries.save();
  
    return tries.purchasedTriesRemaining;
  };
  
  const generateFeaturePaymentTransactionId = (userId, featureId) => {
    const timestamp = Date.now();
    
    // Truncate the userId and featureId if they are too long
    const maxUserIdLength = 12; // Adjust based on your needs
    const maxFeatureIdLength = 12; // Adjust based on your needs

    // Ensure the userId and featureId are within acceptable length
    const truncatedUserId = userId.substring(0, maxUserIdLength);
    const truncatedFeatureId = featureId.substring(0, maxFeatureIdLength);

    // Generate the transaction ID and ensure it is within 38 characters
    const transactionId = `${truncatedUserId}-${truncatedFeatureId}-${timestamp}`;

    // If still too long, truncate further to meet the 38-character limit
    if (transactionId.length > 38) {
        return transactionId.substring(0, 38);
    }

    return transactionId;
};


const initiatePayment = asyncHandler(async (req, res) => {
    try {
        const { featureId, amount, userId, name, triesToPurchase } = req.body;   
        console.log("Initiate Payment and transaction details are as follows:");
        console.log(req.body);
        console.log("generating transaction id");
        const merchantTransaction_Id = generateFeaturePaymentTransactionId(userId, featureId);
        console.log("Generated merchantTransactionId:", merchantTransaction_Id);
        const data = {
            merchantId: process.env.PHONEPE_MERCHANT_ID,
            merchantTransactionId: merchantTransaction_Id,
            merchantUserId: userId,
            amount: amount,
            name: name,
            redirectUrl: `${process.env.BACKEND_URL}/api/tries/status?id=${merchantTransaction_Id}&triesToPurchase=${triesToPurchase}&userId=${userId}`,
            redirectMode: "POST",
            paymentInstrument: {
                type: "PAY_PAGE",
            },
        };

        console.log("-------------------data----------------------------",data);
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
        const triesToPurchase = req.query.triesToPurchase;
        const userId = req.query.userId;
        const merchantId = process.env.PHONEPE_MERCHANT_ID;
        console.log(merchantTransactionId);
        console.log("triesToPurchase:", triesToPurchase);
        console.log("userId:", userId);
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

                        await purchaseTries(triesToPurchase, userId);
                        
                        const url = `${process.env.FRONTEND_URL}/Customs`;
                        return res.redirect(url);
                    } catch (error) {
                        console.log("Error updating order payment status:", error.message);
                        const url = `${process.env.FRONTEND_URL}/PaymentFailedPage?id=${orderId}`;
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
                    const errorUrl = `${process.env.FRONTEND_URL}/PaymentFailedPage?message=${errorMessage}&id=${orderId}`;
                    return res.redirect(errorUrl);

                default:
                    console.log("Unhandled response code:", code);
                    const unhandledUrl = `${process.env.FRONTEND_URL}/PaymentFailedPage?message=Unhandled%20Response&id=${orderId}`;
                    return res.redirect(unhandledUrl);
            }
        } catch (error) {
            console.log("Error with payment request:", error.message);
            const orderId = req.query.id; // Ensure orderId is retrieved if possible
            const url = `${process.env.FRONTEND_URL}/PaymentFailedPage?id=${orderId}`;
            return res.redirect(url);
        }

    } catch (error) {
        console.log(error);
        const orderId = req.query.id; // Ensure orderId is retrieved if possible
        const url = `${process.env.FRONTEND_URL}/PaymentFailedPage?id=${orderId}`;
        return res.redirect(url);
    }
});

export {
    getUserTries,
    useTry,
    purchaseTries,
    initiatePayment,
    checkPaymentStatus,
};