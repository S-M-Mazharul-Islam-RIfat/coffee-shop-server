const express = require('express');
const app = express();
const cors = require('cors');
const jwt = require('jsonwebtoken');
const port = process.env.port || 5000;
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
require('dotenv').config();
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

// middleware
app.use(
   cors({
      origin: [
         "http://localhost:5173",
         "https://coffee-shop-24cac.web.app",
         "https://coffee-shop-24cac.firebaseapp.com"
      ]
   })
);
app.use(express.json());


const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.zahfpvj.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;

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

      const coffeeCollection = client.db("coffeeShopDB").collection("coffee");
      const allUserCollection = client.db("coffeeShopDB").collection("allUsers");
      const orderCollection = client.db("coffeeShopDB").collection("orders");
      const cartCollection = client.db("coffeeShopDB").collection("cart");
      const paymentCollection = client.db("coffeeShopDB").collection("payments");


      // auth related api
      app.post('/jwt', async (req, res) => {
         const user = req.body;
         const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, { expiresIn: '1h' })
         res.send({ token });
      })


      // middlewares
      const verifyToken = (req, res, next) => {
         if (!req.headers.authorization) {
            return res.status(401).send({ message: 'unauthorized access' });
         }
         const token = req.headers.authorization.split(' ')[1];
         jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded) => {
            if (err) {
               return res.status(401).send({ message: 'unauthorized access' });
            }
            req.decoded = decoded;
            next();
         })
      }

      const verifyAdmin = async (req, res, next) => {
         const email = req.decoded.email;
         const query = { email: email };
         const user = await allUserCollection.findOne(query);
         const isAdmin = user?.role === 'admin';
         if (!isAdmin) {
            return res.status(403).send({ message: 'fobidden access' });
         }
         next();
      }


      // users related api
      app.get('/allUsers', verifyToken, verifyAdmin, async (req, res) => {
         const result = await allUserCollection.find().toArray();
         res.send(result);
      })

      app.get('/allUsers/admin/:email', async (req, res) => {
         const email = req.params.email;
         const query = { email: email };
         const user = await allUserCollection.findOne(query);
         let admin = false;
         if (user) {
            admin = user?.role === 'admin';
         }
         res.send({ admin });
      })

      app.get('/allUsers/:email', async (req, res) => {
         const email = req.params.email;
         const query = { email: email };
         const user = await allUserCollection.findOne(query);
         res.send(user);
      })

      app.post('/allUsers', async (req, res) => {
         const newUser = req.body;
         const result = await allUserCollection.insertOne(newUser);
         res.send(result);
      })

      app.patch('/allUsers/:id', verifyToken, verifyAdmin, async (req, res) => {
         const updatedUserInfo = req.body;
         const id = req.params.id;
         const filter = { _id: new ObjectId(id) };
         const updatedUser = {
            $set: {
               name: updatedUserInfo.name,
               email: updatedUserInfo.email,
               role: updatedUserInfo.role
            }
         }
         const result = await allUserCollection.updateOne(filter, updatedUser);
         res.send(result);
      })

      app.delete('/allUsers/:id', verifyToken, verifyAdmin, async (req, res) => {
         const id = req.params.id;
         const query = { _id: new ObjectId(id) };
         const result = await allUserCollection.deleteOne(query);
         return res.send(result);
      })


      // coffee related api
      app.get('/coffee', async (req, res) => {
         const result = await coffeeCollection.find().toArray();
         res.send(result);
      })

      app.get('/coffee/:id', async (req, res) => {
         const id = req.params.id;
         const query = { _id: new ObjectId(id) };
         const result = await coffeeCollection.findOne(query);
         res.send(result);
      })

      app.post('/coffee', verifyToken, verifyAdmin, async (req, res) => {
         const newCoffee = req.body;
         const result = await coffeeCollection.insertOne(newCoffee);
         res.send(result);
      })

      app.patch('/coffee/:id', verifyToken, verifyAdmin, async (req, res) => {
         const coffee = req.body;
         const id = req.params.id;
         const filter = { _id: new ObjectId(id) };
         const updatedCoffee = {
            $set: {
               name: coffee.name,
               chef: coffee.chef,
               supplier: coffee.supplier,
               taste: coffee.taste,
               category: coffee.category,
               price: coffee.price,
               image: coffee.image
            }
         }
         const result = await coffeeCollection.updateOne(filter, updatedCoffee);
         res.send(result);
      })

      app.delete('/coffee/:id', verifyToken, verifyAdmin, async (req, res) => {
         const id = req.params.id;
         const query = { _id: new ObjectId(id) };
         const result = await coffeeCollection.deleteOne(query);
         return res.send(result);
      })


      // cart realted api
      app.get('/cart/:email', verifyToken, async (req, res) => {
         const email = req.params.email;
         const query = { email: email };
         const result = await cartCollection.find(query).toArray();
         res.send(result);
      })

      app.post('/cart', verifyToken, async (req, res) => {
         const newOrder = req.body;
         const result = await cartCollection.insertOne(newOrder);
         res.send(result);
      })

      app.delete('/cart/:id', verifyToken, async (req, res) => {
         const id = req.params.id;
         const query = { _id: new ObjectId(id) };
         const result = await cartCollection.deleteOne(query);
         return res.send(result);
      })


      // orders related api
      app.get('/orders', verifyToken, verifyAdmin, async (req, res) => {
         const result = await orderCollection.find().toArray();
         res.send(result);
      })

      app.get('/orders/:email', verifyToken, async (req, res) => {
         const email = req.params.email;
         const query = { email: email };
         const result = await orderCollection.find(query).toArray();
         res.send(result);
      })

      app.post('/orders', verifyToken, async (req, res) => {
         const newOrder = req.body;
         const result = await orderCollection.insertOne(newOrder);
         res.send(result);
      })

      app.patch('/orders/:id', verifyToken, verifyAdmin, async (req, res) => {
         const id = req.params.id;
         const filter = { _id: new ObjectId(id) };
         const updateStatus = {
            $set: {
               status: 'done',
            }
         }
         const result = await orderCollection.updateOne(filter, updateStatus);
         res.send(result);
      })

      app.delete('/orders/:coffeeId', verifyToken, async (req, res) => {
         const coffeeId = req.params.coffeeId;
         const filter = { coffeeId: coffeeId };
         const result = await orderCollection.deleteOne(filter);
         res.send(result);
      })


      // payments related api
      app.post('/create-payment-intent', verifyToken, async (req, res) => {
         const { price } = req.body;
         const amount = price * 100;
         const paymentIntent = await stripe.paymentIntents.create({
            amount: amount,
            currency: 'usd',
            payment_method_types: ['card']
         });

         res.send({
            clientSecret: paymentIntent.client_secret
         })
      });

      app.get('/payments/:email', verifyToken, async (req, res) => {
         const query = { email: req.params.email }
         const result = await paymentCollection.find(query).toArray();
         res.send(result);
      })

      app.post('/payments', verifyToken, async (req, res) => {
         const payment = req.body;
         const paymentResult = await paymentCollection.insertOne(payment);
         const query1 = {
            _id: {
               $in: payment.cartIds.map(id => new ObjectId(id))
            }
         };
         const query2 = {
            _id: {
               $in: payment.pendingPaymentCoffeIds.map(id => new ObjectId(id))
            }
         };
         const deleteResult = await cartCollection.deleteMany(query1);
         const updatePaymentStatus = {
            $set: {
               payment: 'done',
            }
         }
         const updateResult = await orderCollection.updateMany(query2, updatePaymentStatus);
         res.send({ paymentResult, deleteResult, updateResult });
      })



      // Send a ping to confirm a successful connection
      // await client.db("admin").command({ ping: 1 });
      console.log("Pinged your deployment. You successfully connected to MongoDB!");
   } finally {
      // Ensures that the client will close when you finish/error
      // await client.close();
   }
}
run().catch(console.dir);


app.get('/', (req, res) => {
   res.send('Coffee Shop server is running');
})

app.listen(port, () => {
   console.log(`Coffee Shop server is running on port ${port}`);
})