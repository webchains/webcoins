const spawn = require('threads').spawn;

class Miner {
    constructor(){
        this.message = "miner to mine new blocks on a new thread"
    }

    // mine a block
    mine(block, difficulty){

        const thread = spawn(function(input, done){
            /*eslint-disable */
            const Blocks = require(input.__dirname + '/Block.js');
            /*eslint-enable */

            done(Blocks.startMineBlock(input.block, input.difficulty));
        });

        const promise = thread.promise().then(res => {
            thread.kill();
            return res;
        }).catch(error => {console.log(error);return false;});

        thread.send({
            __dirname: __dirname,
            block: block,
            difficulty: difficulty
        });

        return promise;
    }
}

module.exports = Miner;