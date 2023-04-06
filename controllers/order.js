const stripe = require('stripe')(process.env.STRIPE_SEC_KEY)
const {Course,order} = require('../modules/products')

const pursh = async (req , res)=>{
   try{
      const userID = req.userId
      //get orders from from requies body
      const RequestBody = req.body
      //fetch products data from data base
      console.log(req.body)
      
      const courseID = RequestBody[0].courseID
      //find prducts in data base with IDs
      let db_courses = await Course.find({_id:courseID})
      console.log(JSON.stringify(db_courses))
      if (!db_courses.length){
            res.json({"message":"course not exsists"})
      }
      let NewOrders= await order.find({'userId':userID,'courseID':courseID})
      //
      if(!PrevOrders.length){
         NewOrders = await new order({'state':"pending",'userId':userID,'courseID':courseID}).save()
      }else if(NewOrders.state == "active"){
         return res.status(400).json({"Message":"you already paid for this course"})
      }
      //prepare stripe order details object
      let stripe_orders = db_courses.map((item,index) =>{
            return{
                     price_data:{
                                 currency:'usd',
                                 product_data:{
                                    productId:item._id,
                                    name : item.title
                                 },
                                 unit_amount: Number(Math.floor(item.coste * 100))          
                                 },
                     quantity:1,
                  }
      })
      //check order
      console.log(stripe_orders)
      order.userID = userID
      if(db_courses && db_courses.length !== 0){
         const session = await stripe.checkout.sessions.create({
            payment_method_types :['card'],
            mode:'payment',
            line_items:stripe_orders,
            metadata:{orders:JSON.stringify({'state':"pending",'userId':userID,'courseID':courseID,orderId:NewOrders._id})},
            success_url: 'http://localhost:5500/frontend/homepage.html#/',
            cancel_url: 'http://localhost:5500/frontend/homepage.html#/'
         }).then((resulte)=>{
            //return the response to the user   
            return res.json(resulte)
         }).catch(err=>console.log(err))
         
      }else{
         return res.status(500).json({message:'you did not provide correct order informations'})
      }
   }catch(err){
      console.log({err})
      return res.status(400).json({message:err.message})
   }
}


const updateProduct  = async (data) =>{
      await order.updateOne({'_id':data.orderId},{'state':'active'})  
}
const webhook_callback =  (req , res)=>{
   //get body contents
   let payload = req.body
   const sig = req.headers['stripe-signature'];
   let event;
   try {
     //sign
     event = stripe.webhooks.constructEvent(payload,sig,'whsec_48841faba8675861d5c5e9b800b4d8b39ddb0f60e20fa43797fbacb0b535e668')
   }catch(err){
    console.log(err.message)
    return res.status(404).send()
   }
   if(event.type === 'checkout.session.completed'){
      const session = event.data.object
      console.log(session)
      data = JSON.parse(session.metadata.orders)
      data.stipe_checkout_session_id = session.payment_intent
      updateProduct(data)
      console.log(data)
   }
   res.status(200).send()
}

module.exports = {pursh , webhook_callback}