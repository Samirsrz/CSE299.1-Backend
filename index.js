const express = require('express');
const app = express();
const { MongoClient, ServerApiVersion } = require('mongodb');
const jwt = require('jsonwebtoken');
const cookieParser = require('cookie-parser');
const cors = require('cors');
require('dotenv').config();
const port = process.env.PORT || 5000;

//middleware
app.use(cors({
    origin: [
      'http://localhost:5173',
      'http://localhost:5174',
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



    app.post('/jwt', async(req, res) => {
        const user = req.body;
        const token =  jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, {expiresIn:'365d'})
        res.cookie('token', token, {
            httpOnly:false,
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

   







    await client.db("admin").command({ ping: 1 });
    console.log("Pinged your deployment. You successfully connected to MongoDB!");
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