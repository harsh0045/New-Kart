
const express = require("express");
const app= express();
const mongoose = require("mongoose");
const jwt= require("jsonwebtoken");
const multer = require("multer");
const path =require("path");
const cors= require("cors");
const { log } = require("console");
const Razorpay= require("razorpay");
const crypto=require("crypto");


require("dotenv").config();
const port = process.env.PORT;

app.use(express.json());
app.use(express.urlencoded({extended:false}));
app.use(cors());

//Database connection with mongodb
mongoose.connect(`${process.env.MONGO_URI}`);
console.log('connected with mongodb')
const paymentSchema= new mongoose.Schema({
    razorpay_order_id:{
       type:String,
       required:true,
    },
    razorpay_payment_id:{
     type:String,
     required:true,
    },
    razorpay_signature:{
     type:String,
     required:true,
    }
 });

const Payment =mongoose.model("Payment",paymentSchema);

app.post("/order",async(req,res)=>{
    try{
    const razorpay= new Razorpay({
        key_id:process.env.RAZORPAY_KEY_ID,
        key_secret :process.env.RAZORPAY_SECRET,
    });

    const options = req.body;
    const order = await razorpay.orders.create(options);
    
    if(!order){
        return res.status(500).send("Error");
    }
    res.json(order);
   }catch(err){
    console.log(err);
    res.status(500).send("Error");
   }
})

app.post("/order/validate",async(req,res)=>{
    console.log("Enter verification function through handler function");
    const {razorpay_order_id,razorpay_payment_id,razorpay_signature}= req.body;
    const body= razorpay_order_id + "|" + razorpay_payment_id;
 
   const expectedSignature= crypto
                        .createHmac('sha256',process.env.RAZORPAY_SECRET)
                        .update(body.toString())
                        .digest('hex');

            const isAuthenticate = String(expectedSignature) === String(razorpay_signature);
            
            
            if(isAuthenticate){
                console.log("verified");
                await Payment.create({
                    razorpay_order_id,
                    razorpay_payment_id,
                    razorpay_signature,
                })
               console.log("Payment model created");
               
            //    return res.redirect(
            //          `http://localhost:3000/paymentsuccess?reference=${razorpay_payment_id}`
            //      )
                    return res.redirect(
                        `http://localhost:3000/paymentsuccess?reference=${razorpay_payment_id}`
                    
                    )
              
              
            }
            else{
                console.log("expectedsignature != razorpaysign")
                return res.status(400).json({
                   msg :"Transaction is not legit!"
               });
            }
            
})
app.get("/getkey",(req,res)=>
  res.status(200).json({key:process.env.RAZORPAY_KEY_ID})
);




//API Creation
app.get("/",(req,res)=>{
    res.send("Express App is Running");
})

//Image Storage Engine
const storage = multer.diskStorage(
    {
        destination : './upload/images',
        filename :(req,file,cb)=>{
            return cb(null, `${file.fieldname}_${Date.now()}${path.extname(file.originalname)}`)
        }
    }
)
const upload = multer({storage: storage})

//Creating Upload Endpoint for images
app.use('/images',express.static('upload/images'));

app.post("/upload",upload.single('product'),(req,res)=>{

    res.json(
        {
            success:1,
            image_url:`http://localhost:${port}/images/${req.file.filename}`
        }
    )
})


//Schema for creating products
const Product= mongoose.model("Product",{
    id:{
        type: Number,
        required : true,
    },
    name:{
        type:String,
        required: true,
    },
    image:{
        type:String,
        required: true,
    },
    category:{
        type:String,
        required: true,
    },
    new_price:{
        type:Number,
        required: true,
    },
    old_price:{
        type:Number,
        required: true,
    },
    date:{
        type:Date,
        default: Date.now(),
    },
    avialable:{
        type:Boolean,
        default: true,
    },

})

app.post('/addproduct',async(req,res)=>{
    let products =await Product.find({});
    let id;
    if(products.length>0)
    {
        let last_product_array=products.slice(-1);
        let last_product =last_product_array[0];
        id=last_product.id + 1;
    }
    else{
        id=1;  
    }
    const product=new Product({
        id: id,
        name: req.body.name,
        image: req.body.image,
        category : req.body.category,
        new_price : req.body.new_price,
        old_price : req.body.old_price,
    });
    console.log(product);
    await product.save();
    console.log("Saved");
    res.json(
        {
            success: true,
            name : req.body.name,
        }
    )
})

//Creatiing API for deleting products
app.post('/removeproduct',async(req,res)=>{
    await Product.findOneAndDelete({id: req.body.id});
    console.log("Removed");
    res.json({
        success : true,
        name : req.body.name,
    })
})

//Creating API for getting all products
app.get('/allproducts',async(req,res)=>{
    let products =await Product.find({});
    console.log("All Products Fetched");
    res.send(products);
})

//Schema creating for user model
const Users= mongoose.model('Users',{
    name:{
        type:String,
    },
    email:{
        type: String,
        unique:true,
    },
    password:{
        type: String,
    },
    cartData :{
        type: Object,
    },
    date:{
        type: Date,
        default: Date.now,
    }
})

//Creating Endpoint for registering the user
app.post('/signup',async (req,res)=>{
    let check =await Users.findOne({email:req.body.email});
    if(check){
        return res.status(400).json({success: false, errors :"existing user with same email id"})
    }
    let cart={};
    for(let i=0;i<300 ;i++){
        cart[i]=0;
    }
    const user= new Users({
        name:String(req.body.username),
        email: String(req.body.email),
        password :String(req.body.password),
        cartData : Object(cart),
    })
    console.log("Signup trying to saved saved on mongodb successfully",user);
    await user.save();
    console.log("Signup saved on mongodb successfully");
    const data= {
        user :{
            id : user.id
        }
    }
    const token = jwt.sign(data,'secret_ecom');
    res.json({success: true,token})
})

// creating endpoint for user login
app.post('/login',async(req,res)=>{
    let user = await Users.findOne({email : req.body.email});
    if(user){
        const passCompare = String(req.body.password)=== user.password;
        if(passCompare){
            const data= {
                user:{
                    id : user.id
                }
            }
            const token = jwt.sign(data, 'secret_ecom');
            res.json({success : true, token});
        }
        else{
            res.json({success : false, errors :"Wrong Password"});
        }
    }
    else{
        res.json({success :false, errors :"Wrong Email Id"})
    }
})

// Creating endpoint for new collection data
app.get('/newcollections',async(req,res)=>{
    let products = await Product.find({});
    let newcollection = products.slice(1).slice(-8);
    console.log("NewCollection Fetched");
    res.send(newcollection);

})


//Creating endpoint for popular in women section
app.get('/popularinwomen',async(req,res)=>{
    let products= await Product.find({category :"women"});
    let popular_in_women= products.slice(0,4);
    console.log("Popular in women fetched");
    res.send(popular_in_women);
})


// creating middleware to fetch user
const fetchUser = async(req,res,next)=>{
    const token= req.header('auth-token');
    if(!token){
        res.status(401).send({errors:"Please authenticate using valid token"});
    }
    else{
        try{
           const data= jwt.verify(token , 'secret_ecom');
           req.user=data.user;
           next();
        }catch(error){
           res.status(401).send({errors : "Please authenticate"})
        }
    }
}

// creating endpoint for adding products in cartdata
app.post('/addtocart',fetchUser,async(req,res)=>{
    console.log("Added",req.body.itemId);
    let userData= await Users.findOne({_id:req.user.id});
    userData.cartData[req.body.itemId]+=1;
    await Users.findOneAndUpdate({_id:req.user.id},{cartData:userData.cartData});
    res.send("Added");
})

// creating endpoint to remove product from cartdata
app.post('/removefromcart',fetchUser,async(req,res)=>{
    console.log("remove",req.body.itemId);
    let userData= await Users.findOne({_id:req.user.id});
    if(userData.cartData[req.body.itemId]>0)
    userData.cartData[req.body.itemId]-=1;
    await Users.findOneAndUpdate({_id:req.user.id},{cartData:userData.cartData});
    res.send("Removed");
})

//creating endpoint to get cartdata
app.post('/getcart',fetchUser,async (req,res)=>{
    console.log("GetCart");
    let userData= await Users.findOne({_id: req.user.id});
    res.json(userData.cartData);
})


//

app.listen(port,(error)=>{
    if(!error){
        console.log("Server Running on Port " + port);
    }
    else{
        console.log("Error : " + error);
    }
});
