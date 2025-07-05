import express from "express";
const router = express.Router();
import { sendEmailOtp, verifyEmailOtp } from "../controllers/emailOtpController.js";

router.route("/send")
    .post(sendEmailOtp)

router.route("/verify")
    .post(verifyEmailOtp) 

export default router;