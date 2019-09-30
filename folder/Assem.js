class Assem {
    constructor(blockchain, web){
        this.blockchain = blockchain;
        this.web = web;
    }

    // a general check up to validate the current chain on a schedule
    async check(){
        let count = await this.blockchain.countChain();
        let isValid = await this.blockchain.checkChain();
        if(!isValid || !count){
            console.log('scheduled check: invalid chain. exitting program.');
            await this.web.exitChain();
        } else {
            console.log('scheduled check: valid. all good.');
        }
    }
}

module.exports = Assem;