const _ = require('lodash');
const jsonfile = require('jsonfile');
const fs = require('fs');
const debug = require('debug')('config');

var exports = module.exports = {};
const fileLocation = 'config.json';
const _configFormatting = {spaces: 2, EOL: '\n'};
const _config = {
    apiKey: null,
    trackers: [
        'udp://open.demonii.com:1337/announce',
        'udp://tracker.openbittorrent.com:80',
        'udp://tracker.coppersurfer.tk:6969',
        'udp://glotorrents.pw:6969/announce',
        'udp://tracker.opentrackr.org:1337/announce',
        'udp://torrent.gresille.org:80/announce',
        'udp://p4p.arenabg.com:1337',
        'udp://tracker.leechers-paradise.org:6969'
    ]
};
const configExists = () => fs.existsSync(fileLocation);
const createConfig = () => {
    return new Promise((resolve, reject) => {
        jsonfile.writeFile(fileLocation, _config, _configFormatting, (err) => { 
            if (err) {
                reject(err);
            }
            else {
                resolve();
            }
        });
    });
};

exports.get = (key) => {
    if (!configExists()) {
        return null;
    }
    let obj = jsonfile.readFileSync(fileLocation);
    debug('got config key %s with value %o', key, obj[key]);
    return obj[key];
};

exports.set = (key, value) => {
    return new Promise((resolve, reject) => {
        let o = {};
        o[key] = value;
        if (configExists()) {
            jsonfile.readFile(fileLocation, (err, object) => {
                if (!err) {
                    o = _.extend({}, object, o);
                    debug('writing config with %o', o);
                    jsonfile.writeFile(fileLocation, o, _configFormatting, (err) => {
                        if (err) {
                            reject(err);
                        }
                        else {
                            debug('saved config successfully');
                            resolve();
                        }
                    });
                }
                else {
                    reject(err);
                }
            });
        }
        else {
            createConfig().then(() => {
                debug('created config file');
                o = _.extend({}, _config, o);
                jsonfile.writeFile(fileLocation, o, _configFormatting, (err) => {
                    if (err) {
                        reject(err);
                    }
                    else {
                        resolve();
                    }
                });
            });
        }
    });
};

exports.add = (key, value) => {

};