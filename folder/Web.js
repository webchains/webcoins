const express = require('express');
const Transactions = require('./Transaction.js');
const bodyParser = require('body-parser');
const cors = require('cors');
const morgan = require('morgan');
const md5 = require('md5');
const Block = require('../model/Block.js');
const Tree = require('../model/Tree.js');
const Trees = require('./Tree.js');
const slowDown = require("express-slow-down");
const rateLimit = require("express-rate-limit");
const MongoStore = require('rate-limit-mongo');
const Transaction = require('../model/Transaction.js');
const WebSocket = require('ws');
const axios = require('axios');
const fs = require('fs');
const https = require('https');
const http = require('http');
const { URL, URLSearchParams } = require('url');
const {peerAddress, startFunc} = require('../config.js');
const Blocks = require('./Block.js');
const Post = require('../model/Post.js');
const Proof = require('./Proof.js');
const multer = require('multer');
const path = require('path');

class Web {
    constructor(blockchain){
        this.blockchain = blockchain;

        // settings and configuration // settings and configuration // settings and configuration // settings and configuration // settings and configuration
        // settings and configuration // settings and configuration // settings and configuration // settings and configuration // settings and configuration
        // settings and configuration // settings and configuration // settings and configuration // settings and configuration // settings and configuration

        this.secureDomain = Number(process.env.SECUREDOMAIN);
        if(this.secureDomain){
            this.address = startFunc('https/wss');
        } else {
            this.address = startFunc('http/ws');
        }
        this.port = Number(process.env.PORT);
        this.secureServer = Number(process.env.SECURESERVER);
        if(this.secureServer){
            this.certificate = {cert: process.env.CERTFILE, key: process.env.CERTKEY};
        }
        this.server = null;
        this.heartbeat = Number(process.env.HEARTBEAT);
        // if(this.heartbeat){
        //     this.beats = [];
        // }
        this.proxy = Number(process.env.PROXY);
        this.limitConnections = Number(process.env.LIMITCONNECTIONS);
        this.dbRandom = process.env.RANDOM;
        this.dbName = 'mongodb://localhost:27017/' + md5(this.dbRandom);
        this.sockets = [];
        this.index = process.env.INDEX;
        if(this.index === 'redirect'){
            this.redirect = process.env.REDIRECT;
        }

        // this.MESSAGE_TYPE = {
        //     peer: 'PEER',
        //     update: 'UPDATE',
        //     deUpdate: 'DEUPDATE',
        //     transaction: 'TRANSACTION',
        //     block: 'BLOCK',
        //     state: 'STATE',
        //     dePeer: 'DEPEER',
        //     peers: 'PEERS',
        //     verify: 'VERIFY'
        // };

        this.MESSAGE_TYPE = {
            peer: 'PEER',
            update: 'UPDATE',
            transaction: 'TRANSACTION',
            block: 'BLOCK',
            state: 'STATE',
            node: 'NODE',
            beat: 'BEAT',
            verify: 'VERIFY'
        };
        
        this.app = express();

        this.app.use(cors());
        this.app.use(express.static('base'));
        this.app.use(bodyParser.urlencoded({extended: true}));
        this.app.use(bodyParser.json());
        this.app.use(morgan('dev'));
        if(this.proxy){
            this.app.enable('trust proxy');
        }
        if(this.limitConnections){
            // this.limitDB = new MongoStore({uri: this.dbName, collectionName: 'limitRate'});
            // this.slowDB = new MongoStore({uri: this.dbName, collectionName: 'slowRate'});
            this.limitContentConnect = rateLimit({windowMs: 60000, max: 20, store: new MongoStore({uri: this.dbName, collectionName: 'limitRate'})});
            this.slowContentConnect = slowDown({windowMs: 60000, delayAfter: 10, delayMs: 2000, store: new MongoStore({uri: this.dbName, collectionName: 'slowRate'})});
            this.app.use('/transactions', this.limitContentConnect, this.slowContentConnect);
        }

        // settings and configuration // settings and configuration // settings and configuration // settings and configuration // settings and configuration
        // settings and configuration // settings and configuration // settings and configuration // settings and configuration // settings and configuration
        // settings and configuration // settings and configuration // settings and configuration // settings and configuration // settings and configuration

        //--------------------------------------------------------------------------------------------------------------/

        // connect and handle http // connect and handle http // connect and handle http // connect and handle http // connect and handle http
        // connect and handle http // connect and handle http // connect and handle http // connect and handle http // connect and handle http
        // connect and handle http // connect and handle http // connect and handle http // connect and handle http // connect and handle http

        this.upload = multer({
            // configure multer storage -> saved directory and saved filename
            storage: multer.diskStorage({
                destination: 'base/files',
                filename: (req, file, cb) => {
                    cb(null, md5(Date.now() + file.originalname + file.filename) + path.extname(file.originalname));
                }
            })
        }).single('media');

        if(this.index === 'html'){
            this.app.get('/', (req, res) => {
                return res.sendFile(path.resolve(__dirname + '../base/dist/index.html')); // potential update
                // return res.status(200).json('webcoin');
            });
        } else if(this.index === 'standard'){
            this.app.get('/', (req, res) => {
                // return res.sendFile(path.resolve(__dirname + '../base/dist/index.html')); // potential update
                return res.status(200).json('webcoin');
            });
        } else if(this.index === 'redirect'){
            this.app.get('/', (req, res) => {
                return res.redirect(this.redirect);
            });
        }
        this.app.get('/updates', (req, res) => {
            return res.status(200).json(this.blockchain.updates);
        });
        this.app.post('/updates', (req, res) => {
            if(!req.body.main || !req.body.checksum || this.blockchain.genesisAddress !== this.blockchain.ec.keyFromPrivate(req.body.main, 'hex').getPublic('hex') || this.blockchain.updates.includes(req.body.checksum)){
                return res.status(400).json('error');
            } else {
                this.broadcastUpdate({type: 'UPDATE', data: req.body.checksum});
                this.blockchain.updates.push(req.body.checksum);
                return res.status(200).json('success');
            }
        });
        this.app.delete('/updates', (req, res) => {
            if(!req.body.main || !req.body.checksum || this.blockchain.genesisAddress !== this.blockchain.ec.keyFromPrivate(req.body.main, 'hex').getPublic('hex') || !this.blockchain.updates.includes(req.body.checksum)){
                return res.status(400).json('error');
            } else {
                this.broadcastUpdate({type: 'DEUPDATE', data: req.body.checksum});
                this.blockchain.updates = this.blockchain.updates.filter(e => {return e !== req.body.checksum});
                return res.status(200).json('success');
            }
        });
        this.app.get('/data', (req, res) => {
            return res.status(200).json({genesisAddress: this.blockchain.genesisAddress, address: this.blockchain.address, name: this.blockchain.name, checksum: this.blockchain.checksum, about: this.blockchain.about, current: this.blockchain.current, blocks: this.blockchain.current - 1, count: this.blockchain.count});
        });
        this.app.get('/data/transactions/address/:address', async (req, res) => {
            let address = this.blockchain.ec.keyFromPrivate(req.params.address, 'hex').getPublic('hex');
            let transactions = await Transaction.find({$or: [{fromAddress: address}, {toAddress: address}]}).sort({createdAt: -1}).exec();
            return res.status(200).json(transactions);
        });
        this.app.get('/data/transactions/address/:address/:page/:limit', (req, res) => {
            let address = this.blockchain.ec.keyFromPrivate(req.params.address, 'hex').getPublic('hex');
            Transaction.paginate({$or: [{fromAddress: address}, {toAddress: address}]}, {page: Number(req.params.page), limit: Number(req.params.limit), sort: {createdAt: -1}}, (error, data) => {
                if(error){
                    return res.status(500).json('error');
                } else if(data){
                    return res.status(200).json(data);
                }
            });
        });
        this.app.get('/data/transactions/hash/:hash', async (req, res) => {
            let hash = req.params.hash;
            let transaction = await Transaction.findOne({hash: hash}).exec();
            return res.status(200).json(transaction);
        });
        this.app.get('/data/blocks/hash/:hash', async (req, res) => {
            let hash = req.params.hash;
            let block = await Block.findOne({hash: hash}).exec();
            return res.status(200).json(block);
        });
        this.app.get('/data/blocks/index/:index', async (req, res) => {
            let index = Number(req.params.index);
            let block = await Block.findOne({index: index}).exec();
            return res.status(200).json(block);
        });
        this.app.get('/data/block/chain/:page/:limit', async (req, res) => {
            Block.paginate({}, {sort: {createdAt: 1}, page: Number(req.params.page), limit: Number(req.params.limit)}, (error, data) => {
                if(error){
                    return res.status(500).json('error');
                } else if(data){
                    return res.status(200).json(data);
                }
            });
        });
        this.app.get('/data/tree/chain/:page/:limit', async (req, res) => {
            Tree.paginate({}, {sort: {createdAt: 1}, page: Number(req.params.page), limit: Number(req.params.limit)}, (error, data) => {
                if(error){
                    return res.status(500).json('error');
                } else if(data){
                    return res.status(200).json(data);
                }
            });
        });
        this.app.get('/data/tree/root/:root', async (req, res) => {
            let root = req.params.root;
            let tree = await Tree.findOne({transactionRoot: root}).exec();
            return res.status(200).json(tree);
        });
        this.app.get('/data/tree/hash/:hash', async (req, res) => {
            let hash = req.params.hash;
            let tree = await Tree.findOne({hash: hash}).exec();
            return res.status(200).json(tree);
        });
        this.app.post('/node', (req, res) => {
            if(!req.body.node || typeof(req.body.node) !== 'object' || !req.body.checksum || typeof(req.body.checksum) !== 'string' || this.blockchain.checksum !== req.body.checksum && !this.blockchain.updates.includes(req.body.checksum)){
                return res.status(400).json('error');
            } else {
                let connectNode = req.body.node;
                this.connectNodePeer(connectNode);
                return res.status(200).json({latest: this.blockchain.latest, count: this.blockchain.count, updates: this.blockchain.updates, about: this.blockchain.about, current: this.blockchain.current, name: this.blockchain.name, genesisAddress: this.blockchain.genesisAddress, state: this.blockchain.internalState, pending: this.blockchain.pending});
            }
        });
        this.app.get('/chain', (req, res) => {
            let chain = Block.estimatedDocumentCount();
            return res.status(200).json(chain);
        });
        this.app.get('/current', (req, res) => {
            return res.status(200).json(this.blockchain.current);
        });
        this.app.get('/latest', (req, res) => {
            return res.status(200).json(this.blockchain.latest);
        });
        this.app.get('/pending', (req, res) => {
            return res.status(200).json(this.blockchain.pending);
        });
        this.app.get('/wallet', (req, res) => {
            let wallet = this.blockchain.ec.genKeyPair();
            return res.status(200).json({name: this.blockchain.name, about: this.blockchain.about, privatekey: wallet.getPrivate('hex'), publickey: wallet.getPublic('hex'), balance: 0, message: 'NEVER SHARE YOUR PRIVATE KEY!!!!! ONLY USE YOUR PRIVATE KEY TO SEND COINS'});
        });
        this.app.get('/wallet/:address', async (req, res) => {
            let address = this.blockchain.ec.keyFromPrivate(req.params.address, 'hex').getPublic('hex');
            let balance = await this.blockchain.getBalance(address);
            return res.status(200).json(balance);
        });
        this.app.get('/posts/:page/:limit', (req, res) => {
            Post.paginate({}, {sort: {createdAt: -1}, page: Number(req.params.page), limit: Number(req.params.limit)}, (error, data) => {
                if(error){
                    return res.status(500).json('error');
                } else if(data){
                    return res.status(200).json(data);
                }
            });
        });
        this.app.get('/posts/:post', (req, res) => {
            Post.findOne({_id: req.params.post}, (error, data) => {
                if(error){
                    return res.status(500).json('error');
                } else if(data){
                    return res.status(200).json(data);
                } else if(!data){
                    return res.status(400).json('error');
                }
            });
        });
        this.app.post('/posts', this.upload, this.postCheck, async (req, res) => {
            let post = await this.blockchain.postDB({title: req.body.title, text: req.body.text, media: req.file.filename, reply: []});
            return res.status(200).json(post);
        });
        this.app.post('/posts/reply/:post', this.replyCheck, async (req, res) => {
            let reply = await this.blockchain.replyDB({post: req.params.post, reply: req.body.text});
            if(reply){
                return res.status(200).json(reply);
            } else {
                return res.status(400).json('error');
            }
        });
        this.app.post('/transactions', this.handleTransaction, this.handleBalance, async (req, res) => {
            let main = this.blockchain.ec.keyFromPrivate(req.body.main, 'hex');
            let transaction = new Transactions(main.getPublic('hex'), req.body.address, req.body.amount);
            transaction.signTransaction(main);
            if(Transactions.isTransactionValid(transaction)){
                this.broadcastTransaction({transaction: transaction, peer: this.address});
                this.blockchain.pending.push(transaction);
                return res.status(200).json(transaction);
            } else {
                return res.status(400).json('invalid transaction');
            }
        });
        this.app.post('/transfer/verify/in', this.handleTransferNode, this.chainCheck, async (req, res) => {
            let transaction = new Transactions('TRANSFER', this.blockchain.ec.keyFromPrivate(req.body.main, 'hex').getPublic('hex'), req.body.amount);
            if(Transactions.isTransactionValid(transaction)){
                this.broadcastTransaction({transaction: transaction, peer: this.address});
                this.blockchain.pending.push(transaction);
                return res.status(200).json(transaction);
            } else {
                return res.status(400).json('invalid transfer');
            }
        });
        this.app.post('/transfer/verify/out', this.handleTransferNode, this.chainCheck, this.balanceCheck, async (req, res) => {
            let mainID = this.blockchain.ec.keyFromPrivate(req.body.main, 'hex');
            let address = mainID.getPublic('hex');
            let amount = req.body.amount;
            let transaction = new Transactions(address, 'TRANSFER', amount);
            transaction.signTransaction(mainID);
            if(Transactions.isTransactionValid(transaction)){
                this.broadcastTransaction({transaction: transaction, peer: this.address});
                this.blockchain.pending.push(transaction);
                return res.status(200).json(transaction);
            } else {
                return res.status(400).json('invalid transfer');
            }
        });
        this.app.post('/transfer/out', this.handleTransferData, this.chainCheck, this.balanceCheck, async (req, res) => {
            let mainID = this.blockchain.ec.keyFromPrivate(req.body.main, 'hex');
            let transaction = new Transactions(mainID.getPublic('hex'), 'TRANSFER', req.body.amount);
            transaction.signTransaction(mainID);
            if(Transactions.isTransactionValid(transaction)){
                let mainData = this.transferOut({main: req.body.main, amount: req.body.amount, chain: req.body.chain});
                if(mainData){
                    this.broadcastTransaction({transaction: transaction, peer: this.address});
                    this.blockchain.pending.push(transaction);
                    return res.status(200).json(transaction);
                } else {
                    return res.status(400).json('could not transfer');
                }
            } else {
                return res.status(400).json('invalid transfer');
            }
        });
        this.app.post('/transfer/in', this.handleTransferData, this.chainCheck, async (req, res) => {
            let transaction = new Transactions('TRANSFER', this.blockchain.ec.keyFromPrivate(req.body.main, 'hex').getPublic('hex'), req.body.amount);
            if(Transactions.isTransactionValid(transaction)){
                let mainData = this.transferIn({main: req.body.main, amount: req.body.amount, chain: req.body.chain});
                if(mainData){
                    this.broadcastTransaction({transaction: transaction, peer: this.address});
                    this.blockchain.pending.push(transaction);
                    return res.status(200).json(transaction);
                } else {
                    return res.status(400).json('could not transfer');
                }
            } else {
                return res.status(400).json('invalid transfer');
            }
        });
        this.app.get('/mine', (req, res) => {
            if(this.blockchain.nowMining){
                return res.status(400).json('server is currently mining already');
            } else {
                this.blockchain.mine(this);
                return res.status(200).json('mining block now');
            }
        });
        this.app.get('/miner', (req, res) => {
            return res.status(200).json(this.blockchain.externalState);
        });
        this.app.post('/miner', this.minerCheck, async (req, res) => {
            let proof =  new Proof(req.body.address, req.body.timestamp, req.body.nonce, req.body.hash);
            if(!proof.validDifficulty(this.blockchain.externalState.difficulty) || !proof.validProof()){
                return res.status(400).json('no');
            } else {
                let transaction = new Transactions('GIFT', proof.address, this.blockchain.externalState.reward);
                this.broadcastTransaction({transaction: transaction, peer: this.address});
                this.blockchain.pending.push(transaction);
                return res.status(200).json('yes');
            }
        });
        this.app.get('*', (req, res) => {
            return res.status(200).json('not found');
        });

        // connect and handle http // connect and handle http // connect and handle http // connect and handle http // connect and handle http
        // connect and handle http // connect and handle http // connect and handle http // connect and handle http // connect and handle http
        // connect and handle http // connect and handle http // connect and handle http // connect and handle http // connect and handle http
    }

    // transfers and public mining // transfers and public mining // transfers and public mining // transfers and public mining // transfers and public mining
    // transfers and public mining // transfers and public mining // transfers and public mining // transfers and public mining // transfers and public mining
    // transfers and public mining // transfers and public mining // transfers and public mining // transfers and public mining // transfers and public mining

    postCheck = (req, res, next) => {
        if(!req.body.text && !req.file || !req.body.main || !req.body.title || req.body.title.length > 100 || this.blockchain.ec.keyFromPrivate(req.body.main, 'hex').getPublic('hex') !== this.blockchain.address){
            return res.status(400).json('error');
        } else {
            next();
        }
    }

    replyCheck = (req, res, next) => {
        if(!req.body.text){
            return res.status(400).json('error');
        } else {
            next();
        }
    }

    minerCheck = (req, res, next) => {
        if(!req.body.address || !req.body.timestamp || !req.body.nonce || !req.body.hash || typeof(req.body.address) !== 'string' || typeof(req.body.timestamp) !== 'number' || typeof(req.body.nonce) !== 'number' || typeof(req.body.hash) !== 'string'){
            return res.status(400).json('error');
        } else {
            next();
        }
    }

    balanceCheck = async (req, res, next) => {
        let mainBalance = await this.blockchain.getBalance(this.blockchain.ec.keyFromPrivate(req.body.main, 'hex').getPublic('hex'));
        if(mainBalance < req.body.amount){
            return res.status(400).json('amount is higher than your balance');
        } else {
            next();
        }
    }

    transferIn(data){
        axios.post(data.chain + '/transfer/verify/out', {main: data.main, amount: data.amount}).then(res => {
            console.log(res.data);
            return true;
        }).catch(error => {
            console.log(error.response.data);
            return false;
        });
    }

    transferOut(data){
        axios.post(data.chain + '/transfer/verify/in', {main: data.main, amount: data.amount}).then(res => {
            console.log(res.data);
            return true;
        }).catch(error => {
            console.log(error.response.data);
            return false;
        });
    }

    chainCheck = async (req, res, next) => {
        let checkChain = await this.blockchain.countChain();
        if(checkChain){
            next();
        } else {
            res.status(400).json('bad chain');
            await this.exitChain();
            return false;
        }
    }

    handleTransferData = (req, res, next) => {
        if(!req.body.main || typeof(req.body.main) !== 'string' || !req.body.amount || req.body.amount <= 0 || typeof(req.body.amount) !== "number" || !req.body.chain || typeof(req.body.chain) !== 'string' || req.body.chain === this.address.httpurl){
            return res.status(400).json('error');
        } else {
            next();
        }
    }

    handleTransferNode = (req, res, next) => {
        if(!req.body.main || typeof(req.body.main) !== 'string' || !req.body.amount || req.body.amount <= 0 || typeof(req.body.amount) !== "number"){
            return res.status(400).json('error');
        } else {
            next();
        }
    }

    handleTransaction = (req, res, next) => {
        if(!req.body.main || typeof(req.body.main) !== 'string' || !req.body.address || typeof(req.body.address) !== 'string' || !req.body.amount || req.body.amount <= 0 || typeof(req.body.amount) !== "number"){
            return res.status(400).json('error');
        } else {
            next();
        }
    }

    handleBalance = async (req, res, next) => {
        let mainBalance = await this.blockchain.getBalance(this.blockchain.ec.keyFromPrivate(req.body.main, 'hex').getPublic('hex'));
        if(mainBalance < req.body.amount){
            return res.status(400).json('amount is higher than your balance');
        } else {
            next();
        }
    }

    // transfers and public mining // transfers and public mining // transfers and public mining // transfers and public mining // transfers and public mining
    // transfers and public mining // transfers and public mining // transfers and public mining // transfers and public mining // transfers and public mining
    // transfers and public mining // transfers and public mining // transfers and public mining // transfers and public mining // transfers and public mining

    //-------------------------------------------------------------------------------------------------------------------------------------------------------/

    // start and connect to server // start and connect to server // start and connect to server // start and connect to server // start and connect to server
    // start and connect to server // start and connect to server // start and connect to server // start and connect to server // start and connect to server
    // start and connect to server // start and connect to server // start and connect to server // start and connect to server // start and connect to server

    appListen(){
        if(this.secureServer){
            this.connect = https.createServer({cert: fs.readFileSync(this.certificate.cert), key: fs.readFileSync(this.certificate.key)}, this.app).listen(this.port, '0.0.0.0');
            console.log(`listening on for https on ${this.address.httpurl}`);
        } else {
            this.connect = http.createServer(this.app).listen(this.port, '0.0.0.0');
            console.log(`listening for http on ${this.address.httpurl}`);
        }
    }
    connectNode(){
        axios.post(peerAddress.httpurl + '/node', {node: this.address, type: this.blockchain.type, checksum: this.blockchain.checksum}, {timeout: 10000}).then(res => {
            let data = res.data;
            // this.checkSameType({type: data.type, checksum: data.checksum});
            this.syncChain(data);
        }).catch(error => {console.log(error + '\n' + 'could not connect');this.startGenesisBlock();});
    }

    syncChain(data){
        this.blockchain.name = data.name;
        this.blockchain.about = data.about;
        this.blockchain.updates = data.updates;
        this.blockchain.internalState = data.state;
        this.blockchain.genesisAddress = data.genesisAddress;
        // this.blockchain.current = data.current;
        // this.blockchain.latest = data.latest;
        this.blockchain.pending = data.pending;
        // this.blockchain.count = data.count;
        // console.log('peer 106',this.blockchain.state.genesisHelp)
        console.log('replaced chain');
        console.log('connecting to peers and registering this peer');
    }

    // start and connect to server // start and connect to server // start and connect to server // start and connect to server // start and connect to server
    // start and connect to server // start and connect to server // start and connect to server // start and connect to server // start and connect to server
    // start and connect to server // start and connect to server // start and connect to server // start and connect to server // start and connect to server

    //------------------------------------------------------------------------------------------------------------/

    // connect and handle websocket // connect and handle websocket // connect and handle websocket // connect and handle websocket // connect and handle websocket
    // connect and handle websocket // connect and handle websocket // connect and handle websocket // connect and handle websocket // connect and handle websocket
    // connect and handle websocket // connect and handle websocket // connect and handle websocket // connect and handle websocket // connect and handle websocket

    // start web socket server and listen to connections
    async servListen(){

        this.server = new WebSocket.Server({ server: this.connect });

        this.server.on('connection', (socket, req) => {
            let url = new URL(this.address.wsurl + req.url);
            let address = {hash: url.searchParams.get('hash'), url: url.searchParams.get('url'), httpurl: url.searchParams.get('httpurl'), wsurl: url.searchParams.get('wsurl')};
            console.log('socket connected to server');
            socket.address = address;
            this.connectSocket(socket);
            socket.on('error', error => {
                console.log(error);
                this.removeSocket(socket.address.hash);
            });
            socket.on('close', (code, reason) => {
                console.log('peer disconnected', code, reason);
                this.removeSocket(socket.address.hash);
            });
            /*
            if(!address.domain || !address.hash || !address.httpurl || !address.wsurl){
                socket.close();
                // socket.terminate();
            } else {
                console.log('socket connected to server');
                socket.on('open', () => {
                    socket.address = address;
                    this.connectSocket(socket);
                });
                socket.on('error', error => {
                    console.log(error);
                    clearInterval(socket.beat);
                    this.removeSocket(socket.hash);
                });
                socket.on('close', (code, reason) => {
                    console.log('peer disconnected', code, reason);
                    clearInterval(socket.beat);
                    this.removeSocket(socket.hash);
                });
            }
            */
        });

        this.server.on('error', error => {
            console.log(error);
        });

        this.server.on('close', () => {
            console.log('a peer disconnected');
        });

        await this.blockchain.removeDB();
        this.connectNode();

        console.log(`listening for wss on ${this.address.wsurl}`);
    }

    // first node // first node // first node // first node // first node // first node // first node // first node
    // first node // first node // first node // first node // first node // first node // first node // first node
    // first node // first node // first node // first node // first node // first node // first node // first node

    async connectNodePeer(peer){
        let checkCount = await this.blockchain.countChain();
        if(!checkCount){
            await this.exitChain();
        } else {
            let url = new URL(peer.wsurl);
            let queryParams = new URLSearchParams(url.search);
            queryParams.set('url', this.address.url);
            queryParams.set('hash', this.address.hash);
            queryParams.set('httpurl', this.address.httpurl);
            queryParams.set('wsurl', this.address.wsurl);
            const socket = new WebSocket(url.href + '?' + queryParams.toString());
    
            socket.on('open', async () => {
                socket.address = peer;
                await this.sendNode(socket);
                this.sendVerify(socket);
                this.broadcastPeer(peer);
                this.connectSocket(socket);
            });
            socket.on('error', error => {
                console.log(error);
                // clearInterval(socket.beat);
                this.removeSocket(socket.address.hash);
            });
            socket.on('close', (code, reason) => {
                console.log('peer disconnected', code, reason);
                // clearInterval(socket.beat);
                this.removeSocket(socket.address.hash);
            });
        }
    }

    // first node // first node // first node // first node // first node // first node // first node // first node
    // first node // first node // first node // first node // first node // first node // first node // first node
    // first node // first node // first node // first node // first node // first node // first node // first node

    async exitChain(){
        await this.blockchain.removeDB();
        this.connect.close();
        this.server.close();
        process.exit(0);
    }

    connectOnlyPeer(peer){

        let url = new URL(peer.wsurl);
        let queryParams = new URLSearchParams(url.search);
        queryParams.set('url', this.address.url);
        queryParams.set('hash', this.address.hash);
        queryParams.set('httpurl', this.address.httpurl);
        queryParams.set('wsurl', this.address.wsurl);
        const socket = new WebSocket(url.href + '/?' + queryParams.toString());
        
        socket.on('open', () => {
            socket.address = peer;
            this.connectSocket(socket);
        });
        socket.on('error', error => {
            console.log(error);
            // clearInterval(socket.beat);
            this.removeSocket(socket.address.hash);
        });
        socket.on('close', (code, reason) => {
            console.log('peer disconnected', code, reason);
            // clearInterval(socket.beat);
            this.removeSocket(socket.address.hash);
        });
    }

    // after making connection to a socket
    connectSocket(socket){

        let self = socket;
        if(this.heartbeat){
            self.beat = setInterval(() => {
                self.send(JSON.stringify({
                    type: this.MESSAGE_TYPE.beat,
                    beat: "beat"
                  }));
            }, 30000);
        }

        // push the socket too the socket array
        this.sockets.push(socket);
        console.log("Socket connected");

        // register a message event listener to the socket
        this.messageHandler(socket);
    }

    removeSocket(peer){
        for(let i = 0; i < this.sockets.length; i++){
            if(this.sockets[i].address.url === peer || this.sockets[i].address.httpurl === peer || this.sockets[i].address.wsurl === peer || this.sockets[i].address.hash === peer){
                // this.sendPurge(this.sockets[i]);
                // clearInterval(this.sockets[i].beat);
                if(this.sockets[i].beat){
                    clearInterval(this.sockets[i].beat);
                }
                // this.sockets[i].close();
                this.sockets[i].terminate();
                this.sockets.splice(i, 1);
                console.log('removed peer from broadcast');
                // break;
                return true;
            }
        }
    }

    // connect and handle websocket // connect and handle websocket // connect and handle websocket // connect and handle websocket // connect and handle websocket
    // connect and handle websocket // connect and handle websocket // connect and handle websocket // connect and handle websocket // connect and handle websocket
    // connect and handle websocket // connect and handle websocket // connect and handle websocket // connect and handle websocket // connect and handle websocket

    //-----------------------------------------------------------------------------------------------------/

    // handle a new node // handle a new node // handle a new node // handle a new node // handle a new node
    // handle a new node // handle a new node // handle a new node // handle a new node // handle a new node
    // handle a new node // handle a new node // handle a new node // handle a new node // handle a new node

    sendNode(socket){
        let cursor = Block.find({}).cursor();
        return new Promise((resolve, reject) => {
            cursor.on('data', data => {
                socket.send(JSON.stringify({type: this.MESSAGE_TYPE.node, node: {node: data, peer: this.address}}));
            });
            cursor.on('end', () => {
                resolve(true);
            });
            cursor.on('error', error => {
                console.log(error);
                reject(false);
            });
        });
    }

    // sendBlock(socket){
    //     let cursor = Block.find({}).cursor();
    //     return new Promise((resolve, reject) => {
    //         cursor.on('data', data => {
    //             socket.send(JSON.stringify({type: this.MESSAGE_TYPE.node, node: {type: 'block', node: data}}));
    //         });
    //         cursor.on('end', () => {
    //             resolve(true);
    //         });
    //         cursor.on('error', error => {
    //             console.log(error);
    //             reject(false);
    //         });
    //     });
    // }

    // sendTransaction(socket){
    //     let cursor = Transaction.find({}).cursor();
    //     return new Promise((resolve, reject) => {
    //         cursor.on('data', data => {
    //             socket.send(JSON.stringify({type: this.MESSAGE_TYPE.node, node: {type: 'transaction', node: data}}));
    //         });
    //         cursor.on('end', () => {
    //             resolve(true);
    //         });
    //         cursor.on('error', error => {
    //             console.log(error);
    //             reject(false);
    //         });
    //     });
    // }

    // sendTree(socket){
    //     let cursor = Tree.find({}).cursor();
    //     return new Promise((resolve, reject) => {
    //         cursor.on('data', data => {
    //             socket.send(JSON.stringify({type: this.MESSAGE_TYPE.node, node: {type: 'tree', node: data}}));
    //         });
    //         cursor.on('end', () => {
    //             resolve(true);
    //         });
    //         cursor.on('error', error => {
    //             console.log(error);
    //             reject(false);
    //         });
    //     });
    // }

    sendVerify(socket){
        socket.send(JSON.stringify({type: this.MESSAGE_TYPE.verify, verify: true}));
    }

    async runVerify(){
        console.log('running verification');
        let checkChain = await this.blockchain.checkChain();
        if(checkChain){
            this.blockchain.latest = await this.blockchain.getLatestBlock();
            this.blockchain.current = this.blockchain.latest.index + 1;
            console.log('verification success');
        } else {
            console.log('verification unsuccessful');
            await this.startGenesisBlock();
            console.log('created genesis block for a new webchain');
        }
    }

    async startGenesisBlock(){
        this.sockets.forEach(socket => {
            // socket.close();
            socket.terminate();
        });
        this.sockets = [];
        await this.blockchain.removeDB();
        this.blockchain.createGenesisBlock();
    }

    // handle a new node // handle a new node // handle a new node // handle a new node // handle a new node
    // handle a new node // handle a new node // handle a new node // handle a new node // handle a new node
    // handle a new node // handle a new node // handle a new node // handle a new node // handle a new node

    // ---------------------------------------------------------------------------------------------------------/

    // broadcast to nodes // broadcast to nodes // broadcast to nodes // broadcast to nodes // broadcast to nodes
    // broadcast to nodes // broadcast to nodes // broadcast to nodes // broadcast to nodes // broadcast to nodes
    // broadcast to nodes // broadcast to nodes // broadcast to nodes // broadcast to nodes // broadcast to nodes
    
    // broadcast peer to peers
    broadcastPeer(peer){
        this.sockets.forEach(socket => {
            socket.send(JSON.stringify({
                type: this.MESSAGE_TYPE.peer,
                peer: peer
              })
          );
        });
    }

    broadcastUpdate(update){
        this.sockets.forEach(socket => {
            socket.send(JSON.stringify({
                type: this.MESSAGE_TYPE.update,
                update: update
              })
          );
        });
    }

    broadcastTransaction(transaction){
        this.sockets.forEach(socket => {
            socket.send(JSON.stringify({
                type: this.MESSAGE_TYPE.transaction,
                transaction: transaction
              })
          );
        });
    }

    broadcastBlock(block){
        this.sockets.forEach(socket => {
            socket.send(JSON.stringify({
                type: this.MESSAGE_TYPE.block,
                block: block
              })
          );
        });
    }

    broadcastState(state){
        this.sockets.forEach(socket => {
            socket.send(JSON.stringify({
                type: this.MESSAGE_TYPE.state,
                state: state
              })
          );
        });
    }

    // broadcast to nodes // broadcast to nodes // broadcast to nodes // broadcast to nodes // broadcast to nodes
    // broadcast to nodes // broadcast to nodes // broadcast to nodes // broadcast to nodes // broadcast to nodes
    // broadcast to nodes // broadcast to nodes // broadcast to nodes // broadcast to nodes // broadcast to nodes

    // ---------------------------------------------------------------------------------------------------------/

    // handle the messages // handle the messages // handle the messages // handle the messages // handle the messages
    // handle the messages // handle the messages // handle the messages // handle the messages // handle the messages
    // handle the messages // handle the messages // handle the messages // handle the messages // handle the messages

    messageHandler(socket){
        //on recieving a message execute a callback function
        socket.on('message', async (message) => {
            const data = JSON.parse(message);
            // console.log("data ", data);

            switch(data.type){
                case this.MESSAGE_TYPE.peer:
                    // send the data to checkPeer() function to handle the data
                    this.checkPeer(data.peer);
                    break;
                case this.MESSAGE_TYPE.transaction:
                    // send the data to checkPeer() function to handle the data
                    await this.checkTransaction(data.transaction);
                    break;
                case this.MESSAGE_TYPE.block:
                    // send the data to checkPeer() function to handle the data
                    this.checkBlock(data.block);
                    break;
                case this.MESSAGE_TYPE.state:
                    // send the data to checkPeer() function to handle the data
                    this.checkState(data.state);
                    break;
                case this.MESSAGE_TYPE.update:
                    // send the data to checkPeer() function to handle the data
                    this.checkUpdate(data.update);
                    break;
                case this.MESSAGE_TYPE.beat:
                    // send the data to checkPeer() function to handle the data
                    this.checkBeat(data.beat);
                    break;
                case this.MESSAGE_TYPE.node:
                    // send the data to checkPeer() function to handle the data
                    await this.checkNode(data.node);
                    break;
                case this.MESSAGE_TYPE.verify:
                    // send the data to checkNode()
                    await this.checkVerify(data.verify);
                    break;
            }
            
        });
    }

    // handle the messages // handle the messages // handle the messages // handle the messages // handle the messages
    // handle the messages // handle the messages // handle the messages // handle the messages // handle the messages
    // handle the messages // handle the messages // handle the messages // handle the messages // handle the messages

    // -------------------------------------------------------------------------------------/

    // check messages // check messages // check messages // check messages // check messages
    // check messages // check messages // check messages // check messages // check messages
    // check messages // check messages // check messages // check messages // check messages

    checkBeat(data){
        console.log(data);
    }

    async checkNode(node){
        let block = node.node;
        let check = Blocks.isBlockValid(block);
        if(check){
            let treeTransactions = block.data.map(e => {return e.hash;});
            let tree = new Trees(block.index, block.previousHash, block.hash, treeTransactions, this.blockchain.getMerkleTreeRoot(treeTransactions));
            let dbSave = await this.blockchain.saveDB({block: block, transactions: block.data, tree: tree});
            if(dbSave){
                this.blockchain.count.block = this.blockchain.count.block + 1;
                this.blockchain.count.transaction = this.blockchain.count.transaction + block.data.length;
                this.blockchain.count.tree = this.blockchain.count.tree + 1;
                console.log('saved from node');
            }
            // if(dbSave){
            //     this.blockchain.count.block = this.blockchain.count.block + 1;
            //     this.blockchain.count.transaction = this.blockchain.count.transaction + 1;
            //     this.blockchain.count.tree = this.blockchain.count.tree + 1;
            //     console.log('saved from node');
            // } else {
            //     this.removeSocket(node.peer.hash);
            //     await this.startGenesisBlock();
            // }
        } else {
            this.removeSocket(node.peer.hash);
            await this.startGenesisBlock();
        }
    }

    // validate peer from peer
    checkPeer(peer){
        this.connectOnlyPeer(peer);
        console.log('from peer');
    }

    async checkVerify(verify){
        if(verify){
            await this.runVerify();
        }
    }

    checkUpdate(update){
        if(update.type === 'UPDATE'){
            this.blockchain.updates.push(update.data);
        } else if(update.type === 'DEUPDATE'){
            this.blockchain.updates = this.blockchain.updates.filter(e => {return e !== update.data});
        }
    }

    checkState(state){
        this.blockchain.internalState = state;
        console.log('from peer');
    }

    async checkBlock(block){
        let addedBlock = await this.blockchain.addBlock(block.block);
        if(addedBlock){
            console.log('added valid block from peer');
        } else {
            console.log('invalid block from peer, disconnecting peer');
            this.removeSocket(block.peer.hash);
        }
    }

    // add transaction
    async checkTransaction(transaction){
        if(transaction.transaction.fromAddress !== 'REWARD' || transaction.transaction.fromAddress !== 'TRANSFER' || transaction.transaction.fromAddress !== 'GIFT'){
            let balance = await this.blockchain.getBalance(transaction.transaction.fromAddress);
            if(balance < transaction.transaction.amount || !Transactions.isTransactionValid(transaction.transaction)){
                console.log('invalid transaction');
                this.removeSocket(transaction.peer.hash);
            } else {
                this.blockchain.pending.push(transaction.transaction);
                console.log('from peer');
            }
        } else {
            if(!Transactions.isTransactionValid(transaction.transaction)){
                console.log('invalid transaction');
                this.removeSocket(transaction.peer.hash);
            } else {
                this.blockchain.pending.push(transaction.transaction);
                console.log('from peer');
            }
        }
    }

    // check messages // check messages // check messages // check messages // check messages
    // check messages // check messages // check messages // check messages // check messages
    // check messages // check messages // check messages // check messages // check messages
}

module.exports = Web;