const express = require('express');
const assert = require('assert');
const MongoClient = require('mongodb').MongoClient;
const { Cipher } = require('crypto');
const kms = require("./kms");
const router = express.Router();

const kmsClient = kms.localCsfleHelper();
let dataKey = null;

router.route('/').get( async(req, res, next) => {
    try {

        //const unencryptedClient = await kmsClient.getRegularClient();

        //const dataKey = "zwRM0VwoQUqNrnIcg8LQqw=="; // change this to the base64 encoded data key generated from make-data-key.js
        //const dataKey = kmsClient.findOrCreateDataKey(); 
        if (dataKey === null) {
            unencryptedClient = await kmsClient.getRegularClient();
            console.log("getRegularClient Key");
            dataKey = await kmsClient.findOrCreateDataKey(unencryptedClient);
            console.log("DataKey is "+dataKey);
        }
        const schemaMap = kmsClient.createJsonSchemaMap(dataKey);
        const csfleClient = await kmsClient.getCsfleEnabledClient(schemaMap);
  
        const csfleClientHandsonColl = csfleClient
          .db("test")
          .collection("csfehandson");
    
        // Performs a read using the encrypted client, querying on an encrypted field
        const csfleFindResult = await csfleClientHandsonColl.find({
        });

        const results = await csfleFindResult.toArray();
        let outcomes = '';
        if (results.length > 0) {
            results.forEach((result, i) => {
                outcomes += JSON.stringify(result);
                console.log(result);
            });
        } else {
            console.log('No Data');
        }


        console.log(
          "Document retrieved with csfle enabled client:\n",
          results
        );
        if (csfleClient) await csfleClient.close();
        res.status(200).json(results); 
      } catch (e)
      {
        console.error(e);
        res.status(404).json({error: e});
      }
})
.post(async (req, res, next) => {
    console.log("Request:"+ JSON.stringify(req.body));
    try{
        console.log("CSFE Start");
        //let dataKey = "zwRM0VwoQUqNrnIcg8LQqw=="; // change this to the base64 encoded data key generated from make-data-key.js
        if (dataKey === null) {
            console.log("Search Data Key");
            unencryptedClient = await kmsClient.getRegularClient();
            console.log("getRegularClient Key");
            dataKey = await kmsClient.findOrCreateDataKey(unencryptedClient);
            console.log("DataKey is "+dataKey);
        }
        const exampleDocument = req.body;
        const schemaMap = kmsClient.createJsonSchemaMap(dataKey);
        const csfleClient = await kmsClient.getCsfleEnabledClient(schemaMap);

        const csfleClientHandsonColl = csfleClient
        .db("test")
        .collection("csfehandson");

        await csfleClientHandsonColl.updateOne(
            { ssn: exampleDocument["ssn"] },
            { $set: exampleDocument },
            { upsert: true }
          );

        console.log("POST log");
        res.status(201).json(exampleDocument);
    }catch (err)
    {
        console.error(err);
        next(err);
    } 
});

module.exports = router;