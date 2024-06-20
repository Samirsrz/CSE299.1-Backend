const express = require('express');
const app = express();
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const jwt = require('jsonwebtoken');
const cookieParser = require('cookie-parser');
const cors = require('cors');
require('dotenv').config();
const port = process.env.PORT || 5000;
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY)



//middleware
app.use(cors({
    origin: [
      'http://localhost:5173',
      'http://localhost:5174',
      'https://blood-donation-45cc0.web.app',
      'https://blood-donation-45cc0.firebaseapp.com'
    ],
    credentials: true
  }));
app.use(express.json());
app.use(cookieParser());


const verifyToken = async(req, res, next) => {
    const token = req.cookies?.token;
    if(!token){
        return res.status(401).send({message: "Forbidden"})
    }
    jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded) => {
        if(err) {
            console.log(err);
            res.status(401).send({message: 'unauthorized'})
        }
        req.decoded = decoded;
        next();
    })
        
}
app.post('/logout', async (req, res) => {
    const user = req.body;
    res.clearCookie('token', { maxAge: 0 }).send({ success: true })
  })
  


const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.2aarqjz.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  }
});





async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    // await client.connect();
    // Send a ping to confirm a successful connection

   const database = client.db("BloodDonateDb")
    const donationRequestCollection = database.collection("donationRequest") 

    const usersInfoCollection = database.collection("usersInfo") 

    const blogsCollection = database.collection("blogs")
     const paymentCollection = database.collection("payments");


    app.post('/jwt', async(req, res) => {
        const user = req.body;
        const token =  jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, {expiresIn:'365d'})
        res.cookie('token', token, {
            httpOnly: true,
            secure:true,
            sameSite: 'none'
        })
        .send({success: true})
         
    })




// Get User Info
app.get('/user/:email', verifyToken, async(req, res) => {
  const email = req.params.email;
   const result = await usersInfoCollection.findOne({email});
   res.send(result);
})


  app.post('/user-info', async(req, res) => {
    const userInfo = req.body;
    const result = await usersInfoCollection.insertOne(userInfo);
    res.send(result);
  })

  //search for donor   
  app.get('/search-donor/:district/:upazila/:bloodGroup', async(req, res) => {
    const district = req.params.district;
    const upazila = req.params.upazila;
    const bloodGroup = req.params.bloodGroup;
    const role = 'donor';

    console.log(district,upazila, bloodGroup, role);
    const result = await usersInfoCollection.find({district,upazila, bloodGroup, role}).toArray();
    res.send(result);

    console.log('Ar vallagena');

  })

   
// donation pending req data get

   app.get('/pending-req',async(req, res)=> {
    const pendingData = await donationRequestCollection.find({donationStatus:  'pending'}).toArray();
    res.send(pendingData);
   })


//total user count
app.get('/user-count',async(req, res) => {
  const count = await usersInfoCollection.estimatedDocumentCount();
  res.send({count});
})

  //total donation request count
  app.get('/donation-req-count', async(req,res) => {
      const count = await donationRequestCollection.estimatedDocumentCount();
      res.send({count});
  })   

  app.get('/donation-req-count/:email', async (req, res) => {
    const email = req.params.email;

    try {
      const data = await donationRequestCollection.find({ requesterEmail: email }).toArray();
      res.send(data);
    } catch (error) {
      res.status(500).send({ error: 'Internal Server Error' });
    }
  });
  
    app.delete('/donataion-req-delete/:id', async(req, res) => {
     const id = req.params.id;
     const query = {_id: new ObjectId(id)};
     const result = await donationRequestCollection.deleteOne(query);
     res.send(result);

    })


///Blogs related work

app.get('/blogs', async(req, res) => {
   const result = await blogsCollection.find().toArray();
   res.send(result);
})


 app.post('/add-blog',async(req,res)=> {
  const blogContent = req.body;
  const result = await blogsCollection.insertOne(blogContent);
  res.send(result);
 })

 //blog status updating to publish
app.put('/pulish-blog/:id', async(req, res)=>{
    const blogID = req.params.id;
    const blogStatus = req.body;
    const filter = {_id: new ObjectId(blogID)};
    const options = {upsert: true};
    const updateBlogStatus = {
      $set:{
        blogStatus: blogStatus?.blogStatus
      }
    }

   const result = await blogsCollection.updateOne(filter, updateBlogStatus,options);
   res.send(result);

})

 // blog status (draft) update  
 app.put('/draft-blog/:id', async (req, res) => {
  const blogID = req.params.id;
  const blogStatus = req.body;
  // console.log(blogID,blogStatus.blogStatus);
  const filter = { _id: new ObjectId(blogID) };
  const options = { upsert: true };
  const updateBlogStatus = {
    $set: {
      blogStatus: blogStatus?.blogStatus
    }
  }
  const result = await blogsCollection.updateOne(filter, updateBlogStatus, options)
  res.send(result);
})

//blog status (delete) update
app.delete('/delete-blog/:id', async (req, res) => {
  const id = req.params.id;
  const query = { _id: new ObjectId(id) }
  const result = await blogsCollection.deleteOne(query);
  res.send(result);
})



  //get donation requests
  app.get('/all-donation-requests', verifyToken, async(req,res) => {
    const email = req.query.email;
    const result = await donationRequestCollection.find({requesterEmail: email}).toArray();
    res.send(result);
  })
   
   //get doantion requests data by paging
   app.get('/donation-requests', verifyToken, async (req, res) => {
    const page = parseInt(req.query.page);
    const size = parseInt(req.query.size);
    const email = req.query.email
    // console.log("done",email);

    if (email) {
      const result = await donationRequestCollection.find({ requesterEmail: email })
        .skip(page * size)
        .limit(size)
        .toArray();
      res.send(result);
    }
    else {
      const result = await donationRequestCollection.find()
        .skip(page * size)
        .limit(size)
        .toArray();
      // console.log("rrr",result);
      res.send(result);
    }

  })

 app.post('/add-blog', async(req, res)=> {
    const blogContent = req.body;
    const result = await blogsCollection.insertOne(blogContent);
    res.send(result);
 })



    app.get('/donation-details/:id', async(req, res) => {
      const id = req.params.id;
      console.log(id);
      const query = {_id: new ObjectId(id)}
      const result = await donationRequestCollection.findOne(query);
      res.send(result);
    })

    // donation confirm
    app.put('/donation-confirm/:id', async (req, res) => {
      const donationStatus = req.body;
      const donorID = req.params.id;

      const filter = { _id: new ObjectId(donorID) };
      const options = { upsert: true };
      const updateUserRole = {
        $set: {
          donationStatus: donationStatus?.donationStatus
        }
      }
      const result = await donationRequestCollection.updateOne(filter, updateUserRole, options)
      res.send(result);
    })

//delete request
    app.delete('/donation-req-delete/:id', async(req, res) => {
      const id = req.params.id;
      const query = {_id : new ObjectId(id)};
      const result = await donationRequestCollection.deleteOne(query);
      res.send(result);
    })

//update donation status

 app.put('/donation-status/:id', async(req, res) => {
       const userID = req.params.id;
       const donationStatus = req.body;
       const filter = {_id : new ObjectId(userID)};
       const options = {upsert : true};
       const updateDonationStatus = {
          $set: {
            donationStatus : donationStatus?.donationStatus
          }
       }
       const result = await donationRequestCollection.updateOne(filter, updateDonationStatus, options)
       res.send(result);
 })

  //total user count
  app.get('/user-count', async(req, res) => {
    const count = await usersInfoCollection.estimatedDocumentCount();
    res.send({count});
  })

   //total donation requset count
   app.get('/doantion-req-count', async (req, res) => {
    const count = await donationRequestCollection.estimatedDocumentCount();
    res.send({ count });
  })

   app.get('/user/:email', verifyToken, async(req, res) => {
      
    const email = req.params.email;
    const result = await usersInfoCollection.findOne({email});
    res.send(result);

   })


 //update user info
 app.put('/update-user-info/:email', verifyToken, async(req, res) => {
    const email = req.params.email;
    const userInfo = req.body;
    const filter = {email : email};
    const options = {upsert: true};
    const updateUserInfo = {
      $set:{
        name: userInfo?.name,
        imageURL: userInfo?.imageURL,
        bloodGroup: userInfo?.bloodGroup,
        district: userInfo?.district,
        upazila: userInfo?.upazila
      }
    }

    const result = await usersInfoCollection.updateOne(filter, updateUserInfo, options)
    res.send(result);

 })




  // all-users info
  app.get('/all-users', verifyToken, async(req,res) =>{
    const page = parseInt(req.query.page);
    const size = parseInt(req.query.size);
    const status = req.query.status;

   if(page || size) {
    const result = await usersInfoCollection.find()
    .skip(page * size)
    .limit(size)
    .toArray()
    res.send(result);
   }
   else {
    const result = await usersInfoCollection.find()
      .toArray();
    res.send(result);
  }

  })

  //active user count
  app.get('/active-user-count', async(req, res) => {
    const status = 'active';
    const count = await usersInfoCollection.countDocuments({status});
    res.send({count});
  })

  //blocked user count
  app.get('/blocked-user-count', async (req, res) => {
    const status = 'blocked';
    const count = await usersInfoCollection.countDocuments({ status });
    res.send({ count });
  })


  app.get('/blocked-user/:email', async (req, res) => {
    const email = req.params.email;
    const status = 'blocked';
    const result = await usersInfoCollection.findOne({ email });
    res.send(result);
  })

//update user role

app.put('/user-info/:id', async(req, res)=> {
  const userID = req.params.id;
  const role = req.body;
  const filter = {_id: new ObjectId(userID)};
  const options = {upsert : true};
  const updateUserRole = {
    $set: {
      role : role?.role
    }
  }
   const result = await usersInfoCollection.updateOne(filter, updateUserRole, options)
   res.send(result);

 })

  app.put('/update-status/:id', verifyToken, async(req, res) => {
    const userID = req.params.id;
    const userStatus = req.body;
    const filter = {_id : new ObjectId(userID)}
    const options = {upsert : true};
    const updateUserRole = {
      $set: {
        status: userStatus?.status
      }
    }
    const result = await usersInfoCollection.updateOne(filter, updateUserRole, options);
    res.send(result);
  })

// post donation request
  app.post('/donation-request', verifyToken, async(req,res) => {
    const userInfo = req.body;
    const result =  await donationRequestCollection.insertOne(userInfo);
    res.send(result);    

  })

  app.put('/update-donation-info/:id', async(req, res) => { 
   const updatedInfo = req.body;
   const donorID = req.params.id;
    const filter = {_id : new ObjectId(donorID)};
    const option = {upsert : true};
    const updateUserRole = {

      $set: {
        requesterName: updatedInfo?.requesterName,
        requesterEmail: updatedInfo?.requesterEmail,
        recieptName: updatedInfo?.recieptName,
        address: updatedInfo?.address,
        hospitalName: updatedInfo?.hospitalName,
        bloodGroup: updatedInfo?.bloodGroup,
        time: updatedInfo?.time,
        date: updatedInfo?.date,
        district: updatedInfo?.district,
        upazila: updatedInfo?.upazila,
        requestMessage: updatedInfo?.requestMessage,
        donationStatus: 'pending'
      }
    }

    const result = await donationRequestCollection.updateOne(filter, updateUserRole, options)
    res.send(result);

  })
  
 app.get('/payments/:email',verifyToken, async(req, res) =>{
    const query = {email: req.params.email};
     if(req.params.email !== req.decoded.email) {
      return res.status(403).send({message :'forbidden access'});
     }

     const result = await paymentCollection.find(query).toArray();
     res.send(result);


 })

   app.post('/payments', async(req, res) => {
        const payments = req.body;
        const paymentResult = await paymentCollection.insertOne(payments);

        res.send({ paymentResult });
   })


  //payment intent
  app.post('/create-payment-intent', async(req, res) => {
  
    const {price} = req.body;
    const amount = parseInt(price * 100);
    console.log(amount, 'amount inside the intent');

    const paymentIntent = await stripe.paymentIntents.create({
      amount: amount,
      currency: 'usd',
      payment_method_types: ['card']
       
    })
    res.send({
      clientSecret: paymentIntent.client_secret
    })


  })


 //total fund count
 app.get('/fund-count', async(req,res) => {
    try{
      const totalPriceResult = await paymentCollection.aggregate([
        {
          $group:{
            _id: null,
            total: {$sum:'$price'}
          }
        }
      ]).toArray();
 
      const totalPrice = totalPriceResult.length > 0 ? totalPriceResult[0].total : 0;
      res.send({totalPrice});

    }catch (error){
      console.error(error);
      res.status(500).send({ error: 'Internal Server Error' });
    }
 })




//donation request count
app.get('/donation-requst-count', async(req, res) => {
     const count = await donationRequestCollection.estimatedDocumentCount();
     res.send({count});
})

 //my donation count
 

    // await client.db("admin").command({ ping: 1 });
    // console.log("Pinged your deployment. You successfully connected to MongoDB!");
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);




app.get('/', (req, res) => {
    res.send('Blood donation is going')
})

app.listen(port, () => {
    console.log(`Blood donation is going on post ${port}`);
})