const express = require('express');
const assert = require('assert');
const MongoClient = require('mongodb').MongoClient;
const { Cipher } = require('crypto');
const e = require('express');
const fs = require('fs');
const dotenv = require('dotenv');

dotenv.config();
const mongodb = process.env.MONGODB;
const userid = process.env.USERID;
const databasename = process.env.DATABASE;


const userName = encodeURIComponent(userid);
const router = express.Router();

const cafile = `${__dirname}/../tls/ca-public.crt`;
const cerfikey = `${__dirname}/../tls/client.pem`;
const options = {       
    tls: true,
    tlsCAFile: cafile, 
    tlsCertificateKeyFile: cerfikey,
};

const connectionString = 'mongodb://'+userName+'@' + mongodb + ':27001,' + mongodb + ':27002,' + mongodb + ':27003/?replicaSet=tlsdemo&authMechanism=MONGODB-X509&directConnection=true&retryWrites=true&w=majority&ReadPreference=primaryPreferred';
      

const client = new MongoClient(connectionString, options);

console.log(cafile);
console.log(cerfikey);

router.route('/').get( async(req, res, next) => {
    try{
        await client.connect();
        const database = client.db(databasename);
        const handson = database.collection("handson");
        const query = {};
        const cursor = await handson.find(query);
        
        const results = await cursor.toArray();
        let outcomes = '';
        if (results.length > 0) {
            results.forEach((result, i) => {
                outcomes += JSON.stringify(result);
                console.log(result);
            });
        } else {
            console.log('No Data');
        }

        console.log("Outcomes : "+outcomes);
        res.status(200).json(results);

    } catch(e)
    {
        console.log("Error");
        console.error(e);
        res.status(404).json({});

    }
    finally{
        await client.close();
    }    
});

module.exports = router;