const SHA256 = require('js-sha256');
const { MerkleTree } = require('merkletreejs');

class Trees {
    constructor(blockIndex, blockpreviousHash, blockHash, transactionLeaves, transactionRoot){
        this.blockIndex = blockIndex;
        this.blockpreviousHash = blockpreviousHash;
        this.blockHash = blockHash;
        this.transactionLeaves = transactionLeaves;
        this.transactionRoot = transactionRoot;
        this.hash = this.calculateHash();
    }
    calculateHash(){
        return SHA256(this.blockPreviousHash + this.blockIndex + JSON.stringify(this.transactionLeaves) + this.transactionRoot + this.blockHash).toString();
    }
    static isTreeValid(tree){
        let transactionLeaves = tree.transactionLeaves;
        let transactionTree = new MerkleTree(transactionLeaves, SHA256);
        let transactionRoot = transactionTree.getRoot().toString('hex');
        return transactionRoot === tree.transactionRoot;
    }
}

module.exports = Trees;