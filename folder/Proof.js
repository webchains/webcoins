const SHA256 = require('crypto-js/sha256');

class Proof {
    constructor(address, timestamp, nonce, hash){
        this.address = address;
        this.timestamp = timestamp;
        this.nonce = nonce;
        this.hash = hash;
    }
    validProof(){
        return SHA256(this.address + this.timestamp + this.nonce).toString() === this.hash;
    }
    validDifficulty(data){
        return this.hash.startsWith("0".repeat(data));
    }
    getHash(){
        return SHA256(this.address + this.timestamp + this.nonce).toString();
    }
}

module.exports = Proof;