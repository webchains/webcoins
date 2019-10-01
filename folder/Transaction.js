const SHA256 = require('crypto-js/sha256');
const EC = require('elliptic').ec;
const ec = new EC('secp256k1');

class Transactions {
    constructor(fromAddress, toAddress, amount){
        this.fromAddress = fromAddress;
        this.toAddress = toAddress;
        this.amount = amount;
        this.hash = this.calculateHash();
    }

    // make hash
    calculateHash(){
        return SHA256(this.fromAddress + this.toAddress + this.amount).toString();
    }

    // sign transaction
    signTransaction(signingKey){
        if(signingKey.getPublic('hex') !== this.fromAddress){
            throw new Error('can not sign transactions for other wallets');
        }
        // const hashtx = this.calculateHash();
        const sig = signingKey.sign(this.hash, 'base64');
        this.signature = sig.toDER('hex');
    }

    // validate transaction
    isValid(){
        if(this.fromAddress === 'REWARD'){
            return true;
        }
        if(!this.signature || !this.signature.length){
            console.log('no signature in this transaction');
            return false;
        }
        if(!transaction.fromAddress || !transaction.toAddress){
            console.log("must include addresses");
            return false;
        }
        const publicKey = ec.keyFromPublic(this.fromAddress, 'hex');
        return publicKey.verify(this.hash, this.signature);
    }

    // static version of hash
    static transactionHash(transaction){
        return SHA256(transaction.from + transaction.to + transaction.amount).toString();
    }

    // static version of validation
    static isTransactionValid(transaction){
        if(!transaction.fromAddress || !transaction.toAddress){
            console.log("must include addresses");
            return false;
        } else if(transaction.fromAddress === 'REWARD' || transaction.fromAddress === 'TRANSFER' || transaction.fromAddress === 'GIFT'){
            return true;
        } else if(!transaction.signature || !transaction.signature.length){
            throw new Error('no signature in this transaction');
        } else if(transaction.txid !== Transactions.transactionHash(transaction)){
            return false;
        }
        const publicKey = ec.keyFromPublic(transaction.fromAddress, 'hex');
        return publicKey.verify(transaction.txid, transaction.signature);
    };
}

module.exports = Transactions;