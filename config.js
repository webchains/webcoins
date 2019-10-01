const fs = require('fs-extra');
const glob = require('glob');
const md5 = require('md5');
const crypto = require('crypto');

const peerAddress = {httpurl: process.env.PEERHTTPURL, wsurl: process.env.PEERWSURL};

const internalMineTime = 30000;

const externalMineInterval = 43200000;

const internalRewardMultiplyRate = 2;

const externalRewardDivideRate = 5;

function mineDifficulty(startTime, endTime, difficulty){
    let changeDifficulty = difficulty;
    if(changeDifficulty < 1){
        changeDifficulty = 1;
    } else if(endTime - startTime > internalMineTime){
        changeDifficulty = changeDifficulty - 1;
    } else if(endTime - startTime < internalMineTime){
        changeDifficulty = changeDifficulty + 1;
    }
    let changeReward = changeDifficulty * internalRewardMultiplyRate;
    return {difficulty: changeDifficulty, reward: changeReward};
}

function minerDifficulty(difficulty){
    let changeDifficulty = difficulty;
    let randomNum = Math.floor(Math.random() * 2);
    if(changeDifficulty < 1){
        changeDifficulty = 1;
    } else if(randomNum){
        changeDifficulty = changeDifficulty + 1;
    } else if(!randomNum){
        changeDifficulty = changeDifficulty - 1;
    }
    let changeReward = changeDifficulty / externalRewardDivideRate;
    let expireTime = Date.now() + externalMineInterval;
    let expireDate = new Date(expireTime);
    return {difficulty: changeDifficulty, reward: changeReward, expireTime, expireDate};
}

// checking and making folders-------------------------------------------------------------------------
async function createFolders(path){
    let checkFolder = await promiseFolder(path).then(res => {return true;}).catch(error => {return false;});
    if(checkFolder){
        return true;
    } else {
        let makeFolders = await makeFolder(path).then(res => {return true;}).catch(error =>{return false;});
        if(makeFolders){
            return true;
        } else {
            return false;
        }
    }
}
function promiseFolder(path){
    return new Promise((resolve, reject) => {
        fs.access(path, error => {
            if(error){
                reject(new Error('can not promise a folder'));
            } else {
                resolve(true);
            }
        });
    });
}
function makeFolder(path){
    return new Promise((resolve, reject) => {
        fs.mkdir(path, {recursive: true}, error => {
            if(error){
                reject(new Error('can not make folder'));
            } else {
                resolve(true);
            }
        });
    });
}
// checking and making folders---------------------------------------------------------------------------

function writeDataFile(path, data){
    return new Promise((resolve, reject) => {
        fs.writeFile(path, data, error => {
            if(error){
                console.log(error)
                reject(new Error('can not write file'));
            } else {
                resolve(true);
            }
        });
    });
}

// ---------------------------------------------- delete folders and files --------------------------------
async function deleteFolder(folder){
    let removed = await fs.remove(folder).then(res => {return true;}).catch(error => {console.log(error);return false;});
    return removed;
}
// ---------------------------------------------- delete folders and files --------------------------------

function readDataFile(path){
    return new Promise((resolve, reject) => {
        fs.readFile(path, (error, data) => {
            if(error){
                reject(new Error('can not read file'));
            } else if(data){
                resolve(data);
                // console.log('loadWallet', this.balance, this.publicKey, this.privateKey);
            }
        });
    });
}

function folderName(num){
    return Math.round(num/1000) * 1000;
}

function helpReward(){
    if(Number(process.env.HELP)){
        let giveAmount;
        let keepAmount;
        if(!Number(process.env.GIVE) || Number(process.env.GIVE) > 100){
            giveAmount = 50;
            keepAmount = 100 - giveAmount;
        } else {
            giveAmount = Number(process.env.GIVE);
            keepAmount = 100 - giveAmount;
        }
        return {help: true, give: giveAmount, keep: keepAmount};
    } else {
        return {help: false, give: null, keep: null};
    }
}

function helperReward(data){
    if(Number(data.help)){
        let giveAmount;
        let keepAmount;
        if(!Number(data.give) || Number(data.give) > 100){
            giveAmount = 50;
            keepAmount = 100 - giveAmount;
        } else {
            giveAmount = Number(data.give);
            keepAmount = 100 - giveAmount;
        }
        return {help: true, give: giveAmount, keep: keepAmount};
    } else {
        return {help: false, give: null, keep: null};
    }
}

function removeTransaction(transaction, pending){
    pending = pending.filter(data => {return data.txid !== transaction.txid});
}

function removePost(post, pending){
    pending = pending.filter(data => {return data.pid !== post.pid});
}

async function removeMedia(media, pending){
    let deletedFile = await fs.unlink(__dirname + '/base/files/' + media.media).then(res => {console.log(res);return true;}).catch(error => {console.log(error); return false;});
    deletedFile ? console.log('deleted invalid media') : console.log('could not delete invalid media');
    pending = pending.filter(data => {return data.mid !== media.mid});
}

function mainCheck(data){
    const files = glob.sync(data + '/**/*.js', {ignore: [data + '/node_modules/**', data + '/base/**', data + '/data/**', '.env', '.gitignore']});
    files.sort();
    let allFiles = '';
    for(let i = 0;i < files.length;i++){
        allFiles += fs.readFileSync(files[i]);
    }
    allFiles = allFiles.replace(/\s+/g, '');
    let everyFiles = md5(allFiles);
    console.log(everyFiles);
    fs.writeFileSync('./.webchain', everyFiles);
    return everyFiles;
}

function sideCheck(checksum, checksums){
    if(checksums.includes(checksum)){
        console.log('checksum is good');
    } else {
        console.log('checksum of this chain has been changed, exitting');
        process.exit(0);
    }
}

function startFunc(data){
    if(data === 'internalState'){
        let difficulty = 1;
        let reward = difficulty * 2;
        return {difficulty, reward};
    } else if(data === 'externalState'){
        let difficulty = 3;
        let reward = difficulty / 5;
        let expireTime = Date.now() + 86400000;
        let expireDate = new Date(expireTime);
        return {difficulty, reward, expireTime, expireDate};
    } else if(data === 'http/ws'){
        let address = {url: process.env.DOMAIN, httpurl: `http://${process.env.DOMAIN}:${process.env.PORT}`, wsurl: `ws://${process.env.DOMAIN}:${process.env.PORT}`};
        address.hash = md5(address.httpurl + address.wsurl);
        return address;
    } else if(data === 'https/wss'){
        let address = {url: process.env.DOMAIN, httpurl: `https://${process.env.DOMAIN}:${process.env.PORT}`, wsurl: `wss://${process.env.DOMAIN}:${process.env.PORT}`};
        address.hash = md5(address.httpurl + address.wsurl);
        return address;
    }
}

function encrypt(text){
    let cipher = crypto.createCipheriv('aes-256-cbc', Buffer.from(key), iv);
    let encrypted = cipher.update(text);
    encrypted = Buffer.concat([encrypted, cipher.final()]);
    return { iv: iv.toString('hex'), encryptedData: encrypted.toString('hex') };
   }
   
function decrypt(text){
    let iv = Buffer.from(text.iv, 'hex');
    let encryptedText = Buffer.from(text.encryptedData, 'hex');
    let decipher = crypto.createDecipheriv('aes-256-cbc', Buffer.from(key), iv);
    let decrypted = decipher.update(encryptedText);
    decrypted = Buffer.concat([decrypted, decipher.final()]);
    return decrypted.toString();
   }

module.exports = {decrypt, encrypt, peerAddress, startFunc, mineDifficulty, folderName, createFolders, writeDataFile, readDataFile, promiseFolder, makeFolder, deleteFolder, helpReward, minerDifficulty, helperReward, mainCheck, sideCheck};