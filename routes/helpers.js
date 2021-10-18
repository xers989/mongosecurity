const mongodb = require("mongodb");
const { ClientEncryption } = require("mongodb-client-encryption");
const { MongoClient, Binary } = mongodb;

const dotenv = require('dotenv');

dotenv.config();
const mongodbserver = process.env.MONGODB;
const userid = process.env.USERID;
const databasename = process.env.DATABASE;


const userName = encodeURIComponent(userid);

const cafile = `${__dirname}/../tls/ca-public.crt`;
const cerfikey = `${__dirname}/../tls/client.pem`;

const options = {       
  tls: true,
  tlsAllowInvalidHostnames: true, 
  tlsCAFile: cafile, 
  tlsCertificateKeyFile: cerfikey,
};

module.exports = {
  CsfleHelper: class {
    constructor({
      provider = null,
      kmsProviders = null,
      masterKey = null,
      keyAltNames = "demo-data-key",
      keyDB = "encryption",
      keyColl = "__keyVault",
      schema = null,
      connectionString = 'mongodb://'+userName+'@' + mongodbserver + ':27001/?replicaSet=tlsdemo&authMechanism=MONGODB-X509&directConnection=true&retryWrites=false&w=majority&ReadPreference=primaryPreferred',
      connectionWriteString = 'mongodb://'+userName+'@' + mongodbserver + ':27001/?replicaSet=tlsdemo&authMechanism=MONGODB-X509&directConnection=true&retryWrites=false&w=majority&ReadPreference=primaryPreferred',
      mongocryptdBypassSpawn = false,
      mongocryptdSpawnPath = "mongocryptd",
    } = {}) {
      if (kmsProviders === null) {
        throw new Error("kmsProviders is required");
      }
      if (provider === null) {
        throw new Error("provider is required");
      }
      if (provider !== "local" && masterKey === null) {
        throw new Error("masterKey is required");
      }
      this.kmsProviders = kmsProviders;
      this.masterKey = masterKey;
      this.provider = provider;
      this.keyAltNames = keyAltNames;
      this.keyDB = keyDB;
      this.keyColl = keyColl;
      this.keyVaultNamespace = `${keyDB}.${keyColl}`;
      this.schema = schema;
      this.connectionString = connectionString;
      this.connectionWriteString = connectionWriteString;
      this.mongocryptdBypassSpawn = mongocryptdBypassSpawn;
      this.mongocryptdSpawnPath = mongocryptdSpawnPath;
      this.regularClient = null;
      this.csfleClient = null;
    }

    /**
     * Creates a unique, partial index in the key vault collection
     * on the ``keyAltNames`` field.
     *
     * @param {MongoClient} client
     */
    async ensureUniqueIndexOnKeyVault(client) {
      try {
        await client
          .db(this.keyDB)
          .collection(this.keyColl)
          .createIndex("keyAltNames", {
            unique: true,
            partialFilterExpression: {
              keyAltNames: {
                $exists: true,
              },
            },
          });
      } catch (e) {
        throw new Error(e);
      }
    }

    /**
     * In the guide, https://docs.mongodb.com/ecosystem/use-cases/client-side-field-level-encryption-guide/,
     * we create the data key and then show that it is created by
     * retreiving it using a findOne query. Here, in implementation, we only
     * create the key if it doesn't already exist, ensuring we only have one
     * local data key.
     *
     * @param {MongoClient} client
     */
    async findOrCreateDataKey(client) {
      const encryption = new ClientEncryption(client, {
        keyVaultNamespace: this.keyVaultNamespace,
        kmsProviders: this.kmsProviders
      })

      await this.ensureUniqueIndexOnKeyVault(client)

      let dataKey = await client
        .db(this.keyDB)
        .collection(this.keyColl)
        .findOne({ keyAltNames: { $in: [this.keyAltNames] } })

      if (dataKey === null) {
        dataKey = await encryption.createDataKey("local", {
          keyAltNames: [this.keyAltNames]
        })
        return dataKey.toString("base64")
      }

      return dataKey["_id"].toString("base64")
    }




    async getRegularClient() {
      console.log("getRegularClient"+this.connectionString);
      const client = new MongoClient(this.connectionString, {
        tls: true,
        tlsAllowInvalidHostnames: true, 
        tlsCAFile: cafile, 
        tlsCertificateKeyFile: cerfikey,
        useNewUrlParser: true,
      });
      return await client.connect();
    }

    async getCsfleEnabledClient(schemaMap = null) {
      if (schemaMap === null) {
        throw new Error(
          "schemaMap is a required argument. Build it using the CsfleHelper.createJsonSchemaMap method"
        );
      }
      const client = new MongoClient(this.connectionWriteString, {
        tls: true,
        tlsAllowInvalidHostnames: true, 
        tlsCAFile: cafile, 
        tlsCertificateKeyFile: cerfikey,
        useNewUrlParser: true,
        monitorCommands: true,
        autoEncryption: {
          keyVaultNamespace: this.keyVaultNamespace,
          kmsProviders: this.kmsProviders,
          schemaMap,
        },
      });
      return await client.connect();
    }

    createJsonSchemaMap(dataKey) {
      return {
        "test.csfehandson": {
          bsonType: "object",
          encryptMetadata: {
            keyId: [new Binary(Buffer.from(dataKey, "base64"), 4)],
          },
          properties: {
            address: {
              bsonType: "object",
              properties: {
                street: {
                  encrypt: {
                    bsonType: "string",
                    algorithm: "AEAD_AES_256_CBC_HMAC_SHA_512-Deterministic",
                  },
                },
                zip: {
                  encrypt: {
                    bsonType: "int",
                    algorithm: "AEAD_AES_256_CBC_HMAC_SHA_512-Deterministic",
                  },
                },
              },
            },
            phone: {
              encrypt: {
                bsonType: "string",
                algorithm: "AEAD_AES_256_CBC_HMAC_SHA_512-Random",
              },
            }
          },
        },
      };
    }
  },
};
