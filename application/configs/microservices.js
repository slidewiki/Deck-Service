'use strict';

const co = require('../common');

module.exports = {
    'file': {
        uri: (!co.isEmpty(process.env.SERVICE_URL_FILE)) ? process.env.SERVICE_URL_FILE : 'http://fileservice',
        shareVolume: '/data/files'
    },
    'image': {
        uri: (!co.isEmpty(process.env.SERVICE_URL_IMAGE)) ? process.env.SERVICE_URL_IMAGE : 'http://imageservice',
    },
    'user': {
        uri: (!co.isEmpty(process.env.SERVICE_URL_USER)) ? process.env.SERVICE_URL_USER : 'http://userservice',
    },
};
