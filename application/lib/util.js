'use strict';

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

        // specify file extensions for earch media type
        if(mediaType === 'pictures')
            mediaExtension = 'png|jpeg|jpg|gif||bmp|tiff';
        else if(mediaType === 'video')
            mediaExtension = 'avi|flv|mpg|mpeg|mp4|wmv';
        else if(mediaType === 'audio')
            mediaExtension = 'mp3|wav|wma';

        let urlRegex = new RegExp(`(https?:\\/\\/fileservice[^\\s]+(${mediaExtension}))`, 'g');
        let matchArray;
        let pictures = [];

        while( (matchArray = urlRegex.exec(text)) !== null ){
            pictures.push(matchArray[0].replace(/"/g, ''));     // remove trailing quote
        }

        return pictures;
    },

    // splits the string identifier to {id, revision}
    parseIdentifier: function(identifier) {
        let parsed = String(identifier).match(/^(\d+)(?:-(\d+))?$/);

        // return both undefined if error
        if (!parsed) {
            // regex failed, no fallback!
            return [undefined, undefined];
        }

        let result = { id: parseInt(parsed[1]) };

        // could be undefined, so don't parse (it would result to NaN)
        let revision = parsed[2] && parseInt(parsed[2]);
        if (revision) {
            result.revision = revision;
        }

        return result;
    },

    toIdentifier: function(ref) {
        let revision = ref.revision ? `-${ref.revision}` : '';
        return `${ref.id}${revision}`;
    },

};
