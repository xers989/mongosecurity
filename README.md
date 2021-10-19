# MongoDB Security Demo
MongoDB Security (TLS, Encrypted Storage Engine, Client-Side FLE) with MongoDB 5.0.3 (Ent)    


### MongoDB TLS
#### 1. Applying Self Sign Certificate (MongoDB TLS)
Issuing Self Sign CA Certificate   
Generate Private Key (ca_private.key) and Public Key (ca_public.crt)

````
$ openssl genrsa -out ca_private.key 4096
$ openssl req -new -x509 -days 365 -key ca_private.key -out ca_public.crt
Country Name (2 letter code) [XX]:KR
State or Province Name (full name) []:Seoul
Locality Name (eg, city) [Default City]:Seoul
Organization Name (eg, company) [Default Company Ltd]:YourCompany
Organizational Unit Name (eg, section) []:YourUnit
Common Name (eg, your name or your server's hostname) []:SelfSign Root CA
Email Address []:
````

Issuing Self Sign Server Certificate   
Generate Private Key (server1_private.key) and PEM (server1_cert.pem)

````
$ hostname
mongodb-hostname1
$ openssl genrsa -out server1_private.key 4096
$ openssl req -new -key server1_private.key -out server1_request.csr
..
Organizational Unit Name (eg, section) []: YourUnit
Common Name (eg, your name or your server's hostname) []:mongodb-hostname1
Email Address []:
$ openssl x509 -req -in server1_request.csr -CA ca_public.crt -CAkey ca_private.key -CAcreateserial -out server1_cert.crt -days 365 -sha256
$ cat server1_private.key server1_cert.crt > server1_cert.pem

````
Generate 2 more Server Key and PEM files.
If you run the other nodes on different servers, modify the hostname.   



#### 2. MongoDB Config File
Revising the Config file of the each nodes.   

Generate Replica Set Key File
````
$ openssl ran -base64 741 > /data/keyfile/keyfile
$ chmod 600 /data/keyfile/keyfile
````

Node1
````
$ cat mongodb1.conf
storage:
  dbPath: "/data/mongodb/db1"
systemLog:
  path: "/data/mongodb/logs/mongod1.log"
  destination: "file"
net:
  bindIp : "localhost,yourhostname"
  port: 27001
  tls:
    mode: requireTLS
    certificateKeyFile: /data/cert/server1.pem
    CAFile: /data/cert/ca-public.crt
security:
  authorization: enabled
  keyFile: /data/keyfile/keyfile
replication:
  replSetName: tlsdemo
processManagement:
  fork: true
````

Node2
````
$ cat mongodb2.conf
storage:
  dbPath: "/data/mongodb/db2"
systemLog:
  path: "/data/mongodb/logs/mongod2.log"
  destination: "file"
net:
  bindIp : "localhost,yourhostname"
  port: 27002
  tls:
    mode: requireTLS
    certificateKeyFile: /data/cert/server2.pem
    CAFile: /data/cert/ca-public.crt
security:
  authorization: enabled
  keyFile: /data/keyfile/keyfile
replication:
  replSetName: tlsdemo
processManagement:
  fork: true
````

Node3
````
$ cat mongodb3.conf
storage:
  dbPath: "/data/mongodb/db3"
systemLog:
  path: "/data/mongodb/logs/mongod3.log"
  destination: "file"
net:
  bindIp : "localhost,yourhostname"
  port: 27003
  tls:
    mode: requireTLS
    certificateKeyFile: /data/cert/server3.pem
    CAFile: /data/cert/ca-public.crt
security:
  authorization: enabled
  keyFile: /data/keyfile/keyfile
replication:
  replSetName: tlsdemo
processManagement:
  fork: true
````

Login & Create Users
````
$ mongosh --tls --host yourhostname:27001 --tlsCAFile ./ca-public.crt --authenticationDatabase --tlsCertificateKeyFile ./client.pem
test > rs.initiate()
test > use admin
admin >  db.createUser({
    user: "admin",
    pwd: "yourpassword",
    roles: [
      {role: "root", db: "admin"}
    ]
  })
admin > exit
$ mongosh --tls --host yourhostname:27001 --tlsCAFile ./ca-public.crt --authenticationDatabase --tlsCertificateKeyFile ./server1.pem -u admin -p yourpassword -authenticateDatabase admin
test> rs.add ('hostname:27002')

test> rs.add ('hostname:27003')

test> rs.status()
...
````


#### 3. Applying TLS between nodes
Create User for internal authentication

````
$ openssl x509 -in server1.pem -inform PEM -subject -nameopt RFC2253
subject= CN=ip-10-0-0-219.ap-northeast-2.compute.internal,OU=MongoDB SA,O=MongoDB,L=Seoul,ST=Seoul,C=KR
....
$ mongosh --tls --host yourhostname:27001 --tlsCAFile ./ca-public.crt --authenticationDatabase --tlsCertificateKeyFile ./server1.pem -u admin -p yourpassword -authenticateDatabase admin
test> db.getSiblingDB("$external").runCommand(
  {
    createUser: "CN=ip-10-0-0-219.ap-northeast-2.compute.internal,OU=MongoDB SA,O=MongoDB,L=Seoul,ST=Seoul,C=KR",
    roles: [
        {role: "root", db: "admin"}
    ] }
)
...
````

Revising the config files
Node1
````
$ cat mongodb1.conf
storage:
  dbPath: "/data/mongodb/db1"
systemLog:
  path: "/data/mongodb/logs/mongod1.log"
  destination: "file"
net:
  bindIp : "localhost,yourhostname"
  port: 27001
  tls:
    mode: requireTLS
    certificateKeyFile: /data/cert/server1.pem
    CAFile: /data/cert/ca-public.crt
    clusterFile: /data/cert/server1.pem
security:
  authorization: enabled
  clusterAuthMode: x509
replication:
  replSetName: tlsdemo
processManagement:
  fork: true
````

rebounding the all nodes and login to the cluster and check replica set status.   


#### 4. Running the Node Server & TLS check
Issuing Self Sign Client Certificate   
Generate Private Key (client_private.key) and PEM (client_cert.pem)

````
$ hostname
mypc
$ openssl genrsa -out client_private.key 4096
$ openssl req -new -key client_private.key -out client_request.csr
..
Organizational Unit Name (eg, section) []: YourUnit
Common Name (eg, your name or your server's hostname) []:mypc
Email Address []:
$ openssl x509 -req -in client_request.csr -CA ca_public.crt -CAkey ca_private.key -CAcreateserial -out client_cert.crt -days 365 -sha256
$ cat client_private.key client_cert.crt > client_cert.pem

$ openssl x509 -in server1.pem -inform PEM -subject -nameopt RFC2253
subject= CN=mypc,OU=MongoDB SA,O=MongoDB,L=Seoul,ST=Seoul,C=KR
....
````

Create the client x509 user in $external   
````
$ mongosh --tls --host yourhostname:27001 --tlsCAFile ./ca-public.crt --authenticationDatabase --tlsCertificateKeyFile ./server1.pem -u admin -p yourpassword -authenticateDatabase admin
test> db.getSiblingDB("$external").runCommand(
  {
    createUser: "CN=mypc,OU=MongoDB SA,O=MongoDB,L=Seoul,ST=Seoul,C=KR",
    roles: [
        {role: "root", db: "admin"}
    ] }
)

````

Pull the project and create .env file

.env
````
MONGODB=<<Hostname>
USERID=<<Client Certificate Subject>>
DATABASE=test
````

Running the Nodejs Application
````
$ npm start
> node2@1.0.0 start
> nodemon index

[nodemon] 2.0.13
[nodemon] to restart at any time, enter `rs`
[nodemon] watching path(s): *.*
[nodemon] watching extensions: js,mjs,json
[nodemon] starting `node index index.js`
````

Call REST API of nodejs
````
$ curl --location --request GET 'http://localhost:3000/handson'
[{"_id":"616d79d1b45fdfcd1f32cc6a","ssn":"123-001-0999","address":{"street":"Seoul Jongro-gu, Sejon-ru ","city":"Seoul","zip":123142},"name":"Hong Gil dong","phone":"010-2345-1000"},{"_id":"616d7a8eb45fdfcd1f32cc6b","ssn":"123-456-7890","address":{"street":"Dublin, New York city","city":"New York","zip":155555},"name":"Jon Doe","phone":"010-5555-1000"}]%   
````

Sniffing the connection between nodejs and mongodb cluster with wireShark
<img src="/images/image01.png" width="70%" height="70%">     


#### 5. Login with X509
Cluster login with client X509 Certificate

````
mongosh --tls --host <<hostname>:27001 --tlsCAFile ./ca-public.crt --authenticationDatabase '$external' --authenticationMechanism MONGODB-X509  --tlsCertificateKeyFile ./client_cert.pem

Current Mongosh Log ID:	616e2ccb1606964cd6a4142e
Connecting to:		mongodb://ip-10-0-0-219.ap-northeast-2.compute.internal:27001/?directConnection=true
Using MongoDB:		5.0.3
Using Mongosh:		1.0.5

For mongosh info see: https://docs.mongodb.com/mongodb-shell/

------
   The server generated these startup warnings when booting:
   2021-10-18T13:07:33.109+00:00: Server certificate has no compatible Subject Alternative Name. This may prevent TLS clients from connecting
------

Enterprise tlsdemo [direct: primary] test>

````


### MongoDB TLS

