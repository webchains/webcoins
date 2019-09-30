const SHA256 = require('crypto-js/sha256');
const Transactions = require('./Transaction.js');

class Blocks {
    constructor(index, previousHash, data){
        this.previousHash = previousHash;
        this.index = index;
        this.data = data;
        this.nonce = 0;
        this.hash = this.calculateHash();
    }
    // method to make hash
    calculateHash(){
        return SHA256(this.previousHash + this.index + JSON.stringify(this.data) + this.nonce).toString();
    }
    // method to mine this block
    mineBlock(difficulty){
        while(!this.hash.startsWith("0".repeat(difficulty))){
            this.nonce++;
            this.hash = this.calculateHash();
        }
        console.log("block mined: " + this.hash);
        return this.hash;
    }
    //static version of the hash method
    static startCalculateHash(block){
        return SHA256(block.previousHash + block.index + JSON.stringify(block.data) + block.nonce).toString();
    }
    // static version of the mine method
    static startMineBlock(block, difficulty){
        while(!block.hash.startsWith("0".repeat(difficulty))){
            block.nonce++;
            block.hash = Blocks.startCalculateHash(block);
        }
        console.log("block mined: " + block.hash);
        return block;
    }
    // static method to check the data of the block to make sure it is a good block
    static checkData(newBlock){
        if(newBlock.data.length){
            for(let i = 0; i < newBlock.data.length; i++){
                if(!Transactions.isTransactionValid(newBlock.data[i])){
                    return false;
                }
            }
        }
        return true;
    }
    // static method to validate the block
    static isBlockValid(newBlock){
        if(newBlock.hash !== Blocks.startCalculateHash(newBlock)){
            return false;
        } else if(!Blocks.checkData(newBlock)){
            return false;
        }
        return true;
    }
}

module.exports = Blocks;