const { MongoClient } = require('mongodb');
require('dotenv').config();
async function run() {
  const client = new MongoClient(process.env.MONGODB_URI);
  await client.connect();
  const db = client.db('nerdytips'); // maybe nerdytips db?
  // Let's list all collections
  const collections = await db.listCollections().toArray();
  console.log("Collections:", collections.map(c => c.name));
  await client.close();
}
run().catch(console.error);
