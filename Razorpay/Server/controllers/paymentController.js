import {instance} from "../server.js";
import crypto from "crypto";
import { Payment } from "../models/paymentModel.js";

export const checkout = async(req,res)=>{
    // console.log("enter");
    const options ={
        amount: Number(req.body.amount*100),
        currency :"INR",
    }

    const order = await instance.orders.create(options);

    res.status(200).json({
        success : true,
        order,
    });
};

export const paymentVerification = async(req,res)=>{
    console.log("Enter");
 const {razorpay_order_id,razorpay_payment_id,razorpay_signature}= req.body;
 const body= razorpay_order_id + "|" + razorpay_payment_id;
 
 const expectedSignature= crypto
                        .createHmac('sha256',process.env.RAZORPAY_API_SECRET)
                        .update(body.toString())
                        .digest('hex');

             const isAuthenticate = String(expectedSignature) === String(razorpay_signature);
            
            
            if(isAuthenticate){

                await Payment.create({
                    razorpay_order_id,
                    razorpay_payment_id,
                    razorpay_signature,
                })
               
                res.redirect(
                    `http://localhost:3001/paymentsuccess?reference=${razorpay_payment_id}`
                );
              
            }
            else{
                console.log("Sig received",expectedSignature, razorpay_signature);   
                res.status(200).json({
                   success : false,
               });
            }
            
};

