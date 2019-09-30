const spawn = require('threads').spawn;

const Transaction = require('../model/Transaction.js');
const Block = require('../model/Block.js');
const Tree = require('../model/Tree.js');

class Struct {
    constructor(){
        this.session = 'regular scheduled message, running a verification check';
    }

    async ready(){
        await Transaction.deleteMany({}).exec();
        await Block.deleteMany({}).exec();
        await Tree.deleteMany({}).exec();
    }

    static dedo(data, block){
        let thread = spawn(function(input, done){
            /*eslint-disable */
            let Struct = require(input.__dirname + '/Struct.js');
            /*eslint-enable */

            done(Struct.minerWork(input.data, input.block));
        });

        let promise = thread.promise().then(res => {
            thread.kill();
            return res;
        }).catch(error => {console.log(error);return false;});

        thread.send({
            __dirname: __dirname,
            block: block,
            data: data
        });

        return promise;
    }

    static minerWork(data, block){
        return block.some(e => {return data.every(i => {return e.txid !== i.txid})});
    }
}

module.exports = Struct;