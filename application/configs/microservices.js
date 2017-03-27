'use strict';

const co = require('../common');

module.exports = {
    'file': {
        uri: (!co.isEmpty(process.env.SERVICE_URL_FILE)) ? process.env.SERVICE_URL_FILE : 'http://fileservice'
    },
    'tag': {
        uri: (!co.isEmpty(process.env.SERVICE_URL_TAG)) ? process.env.SERVICE_URL_TAG : 'http://localhost:5000'
    }
};
