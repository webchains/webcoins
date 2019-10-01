const dotenv = require('dotenv').config();
if(dotenv.error){
    console.log('there is an error with the .env file: ' + dotenv.error);
    process.exit(0);
} else if(dotenv.parsed){
    let configs = ['DOMAIN', 'ADDRESS', 'INDEX', 'NAME', 'ABOUT', 'HELP', 'GIVE', 'PEERHTTPURL', 'PEERWSURL', 'STARTUPDOWNLOAD', 'RANDOM', 'PORT', 'LIMITCONNECTIONS', 'SECUREDOMAIN', 'SECURESERVER', 'CERTFILE', 'CERTKEY', 'PROXY', 'HEARTBEAT', 'INDEX', 'REDIRECT'];
    for(const data in dotenv.parsed){
        if(!dotenv.parsed[data] || !configs.includes(data)){
            console.log('all main data is required in the .env file, make sure all the data is set in the .env file, exitting');
            process.exit(0);
        }
    }
}
const {mainCheck} = require('./config.js');
const md5 = require('md5');
const Blockchain = require('./folder/Blockchain.js');
const Web = require('./folder/Web.js');
const Assem = require('./folder/Assem.js');
const mongoose = require('mongoose');
const main = process.env.RANDOM;
const Struct = require('./folder/Struct.js');
mongoose.connect('mongodb://localhost:27017/' + md5(main), { useNewUrlParser: true }, (error) => {
    if(error){
        console.log(error);
    } else {
        console.log('mongodb connected');
    }
});

// (async () => {
//     let walletFolder = await createFolders(__dirname + '/data/wallet').then(res => {return true;}).catch(error => {return false;});
//     walletFolder ? console.log('made wallet folder') : console.log('could not make wallet folder');
//     let staticFolder = await createFolders(__dirname + '/base/files').then(res => {return true;}).catch(error => {return false;});
//     staticFolder ? console.log('created files folder') : console.log("did not create files folder");
// })();

const struct = new Struct();

// make instances
const blockchain = new Blockchain(mainCheck(__dirname));
const web = new Web(blockchain);
// make instances

web.appListen();

web.servListen();

const assem = new Assem(blockchain, web);

setInterval(() => {
    console.log(struct.session);
    assem.check();
    blockchain.timed();
}, 43200000);