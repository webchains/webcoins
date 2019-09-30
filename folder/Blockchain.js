const Blocks = require('./Block.js');
const Transactions = require('./Transaction.js');
const Miner = require('./Mine.js');
const Block = require('../model/Block.js');
const Transaction = require('../model/Transaction.js');

const EC = require('elliptic').ec;
const Struct = require('./Struct.js');
const {MerkleTree} = require('merkletreejs');
const SHA256 = require('js-sha256');
const Tree = require('../model/Tree.js');
const Trees = require('./Tree.js');
const Post = require('../model/Post.js');
const {startFunc, mineDifficulty, helpReward} = require('../config.js');

class Blockchain {
    constructor(checksum){
        this.checksum = checksum;
        this.updates = [];
        // this.hashes = []; potential update
        // this.checksums = []; potential update
        this.name = process.env.NAME;
        this.about = process.env.ABOUT;
        this.genesisAddress = null;
        this.address = process.env.ADDRESS;
        this.genesisHelp = helpReward();
        this.count = {transaction: 0, block: 0, tree: 0};
        // this.mined = {transaction: null, block: null, tree: null};
        this.internalState = startFunc('internalState');
        this.externalState = startFunc('externalState');
        this.struct = new Struct();
        this.ec = new EC('secp256k1');
        this.miner = new Miner();
        this.nowMining = false;
        this.pending = [new Transactions("REWARD", "EVERYONE", 0)];
        this.latest = null;
        this.current = null;
    }
    
    timed(){
        let randomNum = Math.floor(Math.random() * 2);
        if(this.externalState.difficulty > 1 && this.externalState.difficulty < 6){
            if(randomNum){
                this.externalState.difficulty = this.externalState.difficulty + 1;
            } else {
                this.externalState.difficulty = this.externalState.difficulty - 1;
            }
        } else if(this.externalState.difficulty <= 1){
            this.externalState.difficulty = this.externalState.difficulty + 1;
        } else if(this.externalState.difficulty >= 6){
            this.externalState.difficulty = this.externalState.difficulty - 1;
        }
        this.externalState.reward = this.externalState.difficulty / 5;
        this.externalState.expireTime = Date.now() + 86400000;
        this.externalState.expireDate = new Date(this.externalState.expireTime);
    }

    // create the genesis or retrieve the latest block if there are already blocks that was saved before
    async createGenesisBlock(){

            let transaction = new Transactions("REWARD", "EVERYONE", 0);
            let genesis = new Blocks(0, 'GENESIS', [transaction]);
            let treeTransactions = genesis.data.map(e => {return e.hash;});
            let tree = new Trees(genesis.index, genesis.previousHash, genesis.hash, treeTransactions, this.getMerkleTreeRoot(treeTransactions));
            let savedDB = await this.saveDB({block: genesis, transactions: genesis.data, tree: tree});
            savedDB ? console.log('saved db') : console.log('did not save db');
            // this.mined.block = savedDB.block;
            // this.mined.transaction = savedDB.transactions;
            // this.mined.tree = savedDB.tree;
            this.latest = genesis;
            this.current = genesis.index + 1;
            this.address = this.genesisAddress;
            // this.genesisHelp = {help: false, give: null, keep: null};
            this.count.transaction = genesis.data.length;
            this.count.tree = 1;
            this.count.block = 1;
            // console.log('blockchain 65', this.genesisHelp);
            console.log('done with genesis');
    }

    getMerkleTreeRoot(data){
        let tree = new MerkleTree(data, SHA256);
        let root = tree.getRoot().toString('hex');
        return root
    }

    // find the genesis block
    async findGenesis(){
        const res = await Block.findOne({ index: 0 }).exec();
        return res;
    }

    // retrieve the latest block
    async getLatestBlock(){
        const res = await Block.findOne().sort({ index: -1 }).exec();
        return res;
    }

    // get a specific block
    async getSomeBlock(block){
        const res = await Block.findOne({ index: block }).exec();
        return res;
    }

    async countChain(){
        let countBlocks = await this.countBlocks('find');
        let countTransactions = await this.countTransactions('find');
        let countTrees = await this.countTrees('find');
        if(countBlocks !== this.count.block || countTransactions !== this.count.transaction || countTrees !== this.count.tree){
            return false;
        } else {
            return true;
        }
    }

    async countTransactions(data){
        if(data === 'find'){
            let count = await Transaction.find({}).lean(true).exec();
            return count.length;
        } else if(data === 'scan'){
            let count = await Transaction.countDocuments().exec();
            return count;
        } else if(data === 'meta'){
            let count = await Transaction.estimatedDocumentCount().exec();
            return count;
        }
    }

    async countBlocks(data){
        if(data === 'find'){
            let count = await Block.find({}).lean(true).exec();
            return count.length;
        } else if(data === 'scan'){
            let count = await Block.countDocuments().exec();
            return count;
        } else if(data === 'meta'){
            let count = await Block.estimatedDocumentCount().exec();
            return count;
        }
    }

    async countTrees(data){
        if(data === 'find'){
            let count = await Tree.find({}).lean(true).exec();
            return count.length;
        } else if(data === 'scan'){
            let count = await Tree.countDocuments().exec();
            return count;
        } else if(data === 'meta'){
            let count = await Tree.estimatedDocumentCount().exec();
            return count;
        }
    }

    // mine a block
    async mine(peerNode){
        this.nowMining = true;
        let startTimestamp = Date.now();
        let blockMine = await this.miner.mine(new Blocks(this.current, this.latest.hash, this.pending), this.internalState.difficulty);
        let endTimestamp = Date.now();
        this.nowMining = false;
        blockMine ? console.log('trying to add mined block') : console.log('block was not mined');
        let checkThisBlock = await this.addNextBlock(peerNode, blockMine, startTimestamp, endTimestamp);
        if(checkThisBlock){
            console.log('done with add block process');
        } else {
            console.log('can not finish add block process');
        }
        console.log('done fully mining, on full new block');
    }

    // start next block
    async addNextBlock(peer, nextBlock, start, end){
        let addedBlock = await this.addBlock(nextBlock);
        if(addedBlock){
            peer.broadcastBlock({block: nextBlock, peer: {domain: peer.address.domain, hash: peer.address.hash, httpurl: peer.address.httpurl, wsurl: peer.address.wsurl}});
            this.startFunc(peer);
            if(this.genesisHelp.help){
                this.helpFunc(peer);
            }
            console.log(`done with rewarding the miner, on block#${this.current} now`);
            this.internalState.difficulty = mineDifficulty(start, end, this.internalState.difficulty);
            this.internalState.reward = this.internalState.difficulty * 2;
            peer.broadcastState({difficulty: this.internalState.difficulty, reward: this.internalState.reward});
            console.log('broadcasted to peers');
            return true;
        } else {
            console.log('could not add invalid block');
            return false;
        }
    }

    startFunc(peer){
        let rewardMinerTransaction = new Transactions("REWARD", this.address, this.genesisHelp.help ? this.internalState.reward * Number('.' + this.genesisHelp.keep) : this.internalState.reward);
        this.pending.push(rewardMinerTransaction);
        peer.broadcastTransaction({transaction: rewardMinerTransaction, peer: {domain: peer.address.domain, hash: peer.address.hash, httpurl: peer.address.httpurl, wsurl: peer.address.wsurl}});
        console.log('added transaction');
        console.log('mined, added block, and synced with block data');
    }

    helpFunc(peer){
        let rewardHelpTransaction = new Transactions("REWARD", this.genesisAddress, this.internalState.reward * Number('.' + this.genesisHelp.give));
        this.pending.push(rewardHelpTransaction);
        peer.broadcastTransaction({transaction: rewardHelpTransaction, peer: {domain: peer.address.domain, hash: peer.address.hash, httpurl: peer.address.httpurl, wsurl: peer.address.wsurl}});
        console.log('added help transaction');
        console.log('sent all the help');
    }

    // save a block on DB
    async blockDB(block){
        const res = await new Block({ index: block.index, previousHash: block.previousHash, hash: block.hash, nonce: block.nonce, data: block.data }).save();
        return res;
    }

    // save a transaction on DB
    async transactionDB(transaction){
        const res = await new Transaction({ fromAddress: transaction.fromAddress, toAddress: transaction.toAddress, amount: transaction.amount, hash: transaction.hash, signature: transaction.signature }).save();
        return res;
    }

    // save a post on DB
    async postDB(post){
        const res = await new Post({ text: post.text, media: post.media }).save();
        return res;
    }

    async treeDB(tree){
        const res = await new Tree({blockIndex: tree.blockIndex, blockPreviousHash: tree.blockPreviousHash, blockHash: tree.blockHash, transactionLeaves: tree.transactionLeaves, transactionRoot: tree.transactionRoot, hash: tree.hash}).save();
        return res;
    }

    async saveDB(data){
        let saveBlock = await this.blockDB(data.block);
        if(!saveBlock){
            return false;
        }
        let saveTransactions = await this.saveMinedData(data.transactions);
        if(!saveTransactions){
            return false;
        }
        let saveTree = await this.treeDB(data.tree);
        if(!saveTree){
            return false;
        }
        // return {block: saveBlock, transactions: saveTransactions, tree: saveTree};
        return true;
    }

    async saveMinedData(data){
        // let transactions = [];
        for(let i = 0;i < data.length;i++){
            let transaction = await this.transactionDB(data[i]);
            if(!transaction){
                return false;
            }
            // if(!transaction){
            //     return false;
            // } else {
            //     transactions.push(transaction);
            // }
        }
        return true;
    }

    // validate a block
    async addBlock(block){

        console.log('adding block processing');

        if(this.latest.index + 1 !== block.index){
            return false;
        }

        if(this.latest.hash !== block.previousHash){
            return false;
        }

        let dataToCheck = await Struct.dedo(this.pending, block.data);

        if(dataToCheck){
            return false;
        }

        if(!Blocks.isBlockValid(block)){
            return false;
        }

        let treeTransactions = block.data.map(e => {return e.hash;});
        let tree = new Trees(block.index, block.previousHash, block.hash, treeTransactions, this.getMerkleTreeRoot(treeTransactions));

        let dbSave = await this.saveDB({block: block, transactions: block.data, tree: tree});
        if(!dbSave){
            return false;
        }
        console.log('saved db');

        this.redo(block.data);

        this.count.transaction = this.count.transaction + block.data.length;
        this.count.block = this.count.block + 1;
        this.count.tree = this.count.tree + 1;

        this.latest = block;
        this.current = this.current + 1;

        console.log('adding block completed');

        return true;
    }

    redo(data){
        this.pending = this.pending.filter(e => {return data.every(i => {return e.hash !== i.hash;});});
    }

    // get the balance of a wallet
    async getBalance(address){
        let balance = 0;
        let chain = await Transaction.find({$or: [{fromAddress: address}, {toAddress: address}]}).exec();
        balance = this.balanceFromAddress(balance, address, chain);
        balance = this.balanceFromAddress(balance, address, this.pending);
        return balance;
    }

    // go through all of the transactions
    balanceFromAddress(balance, address, transactions){
        for(const tx of transactions){
            if(tx.fromAddress === address){
                balance -= tx.amount;
            }
            if(tx.toAddress === address){
                balance += tx.amount;
            }
        }
        return balance;
    }

    async checkChain(){
        let chain = await this.getChain();
        let check = this.isValidChain({blocks: chain.blocks, transactions: chain.transactions, trees: chain.trees});
        return check;
    }

    // one of the validations for the chain
    isValidBlocks(data){
        if(!Blocks.isBlockValid(data[0])){
            return false;
        }
        for(let i = 1; i < data.length; i++){
            const currentBlock = data[i];
            const previousBlock = data[i - 1];
            if(!Blocks.isBlockValid(currentBlock)){
                return false;
            }
            if(currentBlock.previousHash !== previousBlock.hash){
                return false;
            }
            if(previousBlock.index + 1 !== currentBlock.index){
                return false;
            }
        }
        return true;
    }

    isValidChain(data){
        let blocks = this.isValidBlocks(data.blocks);
        if(!blocks){
            return false;
        }
        let transactions = this.isValidTransactions(data.transactions);
        if(!transactions){
            return false;
        }
        let trees = this.isValidTrees(data.trees);
        if(!trees){
            return false;
        }
        return true;
    }

    // delete the entire chain
    async removeDB(){
        await Block.deleteMany({});
        await Transaction.deleteMany({});
        await Tree.deleteMany({});
        return true;
    }

    // check if base contents are valid
    isValidTransactions(data){
        for(let i = 0; i < data.length; i++){
            if(!Transactions.isTransactionValid(data[i])){
                return false;
            }
        }
        return true;
    }

    isValidTrees(trees){
        for(let i = 0;i < trees.length;i++){
            if(!Trees.isTreeValid(trees[i])){
                return false;
            }
        }
        return true;
    }

getBlocks(){
    let cursor = Block.find({}).sort({index: 1}).cursor();
    return new Promise((resolve, reject) => {
        let fullChain = [];
        cursor.on('data', data => {fullChain.push(data);});
        cursor.on('end', () => {resolve(fullChain);});
        cursor.on('error', error => {console.log(error);reject(false);});
    });
}

getTransactions(){
    let cursor = Transaction.find({}).cursor();
    return new Promise((resolve, reject) => {
        let allTransactions = [];
        cursor.on('data', data => {allTransactions.push(data);});
        cursor.on('end', () => {resolve(allTransactions);});
        cursor.on('error', error => {console.log(error);reject(false);});
    });
}

getTrees(){
    let cursor = Tree.find({}).cursor();
    return new Promise((resolve, reject) => {
        let allTrees = [];
        cursor.on('data', data => {allTrees.push(data);});
        cursor.on('end', () => {resolve(allTrees);});
        cursor.on('error', error => {console.log(error);reject(false);});
    });
}

async getChain(){
    let blocks = await this.getBlocks();
    let transactions = await this.getTransactions();
    let trees = await this.getTrees();
    return {blocks, transactions, trees};
}
}

module.exports = Blockchain;