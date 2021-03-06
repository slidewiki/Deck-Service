'use strict';

const _ = require('lodash');

const url = require('url');
const Microservices = require('../configs/microservices');
const fileserviceHost = url.parse(Microservices.file.uri).hostname;

// updates the elements in original by assigning values from update using id property to match elements in arrays
let self = module.exports = {

    assignToAllById: function(original, update) {
        original.forEach((val) => {
            // if not found does nothing :)
            Object.assign(val, update.find((el) => el.id === val.id) );
        });
        return original;
    },

    // find fileservice media in html or text
    findMedia: function(text, mediaType){
        let mediaExtension;

        // specify file extensions for each media type
        if(mediaType === 'pictures')
            mediaExtension = 'png|jpeg|jpg|gif|bmp|tiff';
        else if(mediaType === 'video')
            mediaExtension = 'avi|flv|mpg|mpeg|mp4|wmv';
        else if(mediaType === 'audio')
            mediaExtension = 'mp3|wav|wma';

        let urlRegex = new RegExp(`https?:\\/\\/${fileserviceHost}[^\\s]+(\\.${mediaExtension})`, 'g');
        let matchArray;
        let media = [];

        while( (matchArray = urlRegex.exec(text)) !== null ){
            media.push(matchArray[0]);
        }

        return media;
    },

    // splits the string identifier to {id, revision}
    parseIdentifier: function(identifier) {
        let parsed = String(identifier).match(/^(\d+)(?:-(\d+))?$/);

        // return nothing undefined if error
        if (!parsed) return;

        let result = { id: parseInt(parsed[1]) };

        // could be undefined, so don't parse (it would result to NaN)
        let revision = parsed[2] && parseInt(parsed[2]);
        if (revision) {
            result.revision = revision;
        }

        return result;
    },

    toIdentifier: function(ref) {
        // return nothing for null or invalid data
        if (!ref || !ref.id) return;

        let revision = ref.revision ? `-${ref.revision}` : '';
        return `${ref.id}${revision}`;
    },

    toPlatformPath: function(path) {
        if (_.isEmpty(path)) return '';

        // first path part is always a deck
        let result = `/deck/${self.toIdentifier(path[0])}`;

        if (path.length > 1) {
            // not just the root
            let [leaf] = path.slice(-1);
            if (leaf.kind === 'slide') {
                result += `/slide/${self.toIdentifier(leaf)}`;
            } else {
                result += `/deck/${self.toIdentifier(leaf)}`;
            }
        }

        return result + '/' + path.slice(1).map(formatPlatformPathPart).join(';');
    },

};

function formatPlatformPathPart(pathPart) {
    let affix = _.isNumber(pathPart.index) ? `${pathPart.index + 1}` : undefined;
    return _.compact([self.toIdentifier(pathPart), affix]).join(':');
}
