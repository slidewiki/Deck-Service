'use strict';

//require
let Ajv = require('ajv');
let ajv = Ajv({
    verbose: true,
    allErrors: true
    //v5: true  //enable v5 proposal of JSON-schema standard
}); // options can be passed, e.g. {allErrors: true}

//build schema
const objectid = {
    type: 'integer',
    maxLength: 24,
    minLength: 1
};

const dataSource = {
    type: 'object',
    properties: {
        type: {
            type: 'string'
        },
        title: {
            type: 'string'
        },
        url: {
            type: 'string'
        },
        comment: {
            type: 'string'
        },
        authors: {
            type: 'string'
        },
        year: {
            type: 'string'
        }
    },
    required: ['type','title']
};
const annotation = {
    type: 'object',
    properties: {
        uri: { //@id
            type: 'string'
        },
        type: { //@type
            type: 'array',
            items: {
                type: 'string'
            }
        },
        name: { //Schema:name
            type: 'string'
        },
        inlineId: { //Schema:identifier
            type: 'string'
        },
        autoGenerated: { //_autoGenerated
            type: 'boolean'
        }
    }
};
const slideRevision = {
    type: 'object',
    properties: {
        id: { //increment with every new revision
            type: 'number',
            minimum: 1
        },
        title: {
            type: 'string'
        },
        timestamp: {
            type: 'string',
            format: 'date-time'
        },
        content: {
            type: 'string'
        },
        markdown: {
            type: 'string'
        },
        speakernotes: {
            type: 'string'
        },
        user: objectid,
        parent: {
            type: 'object',
            properties: {
                id: objectid,
                revision: {
                    type: 'number'
                }
            }
        }, //ObjectId or Number or both
        popularity: {
            type: 'number',
            minimum: 0
        },
        comment: {
            type: 'string'
        },
        note: {
            type: 'string'
        },
        translation: {
            type: 'object',
            properties: {
                status: {
                    type: 'string',
                    enum: ['original', 'google', 'revised']
                },
                translator: objectid,
                source: {
                    type: 'object'
                }
            }
        },
        tags: {
            type: 'array',
            items: {
                type: 'object',
                properties: {
                    tagName: {
                        type: 'string',
                    },
                    // TODO add other properties as well in sync with the tag-service
                },
            },
        },
        media: {
            type: 'array',
            items: objectid
        },
        dataSources: {
            type: 'array',
            items: dataSource
        },
        annotations: {
            type: 'array',
            items: annotation
        },
        usage: {
            type: 'array',
            items: {
                type: 'object',
                properties: {
                    id: objectid,
                    revision: {
                        type: 'number',
                        minimum: 1
                    }
                },
                required: ['id','revision']
            }
        },
        language: {
            type: 'string'
        },
        dimensions: {
            type: 'object',
            properties: {
                width: {
                    type: 'integer',
                    minimum: 1,
                },
                height:{
                    type: 'integer',
                    minimum: 1,
                },
            },
            required: ['width', 'height'],
        },
        transition: {
            type: 'string'
        }
    },
    required: ['id', 'user']
};
const slide = {
    type: 'object',
    properties: {
        user: objectid,
        // kind: {
        //     type: 'string'
        // },
        description: {
            type: 'string'
        },
        license: {
            type: 'string',
            enum: ['CC0', 'CC BY', 'CC BY-SA']
        },
        // language: {
        //     type: 'string'
        // },
        // translation: {
        //     type: 'object',
        //     properties: {
        //         status: {
        //             type: 'string',
        //             enum: ['original', 'google', 'revised', null]
        //         },
        //         translator: objectid,
        //         source: {
        //             type: 'object'
        //         }
        //     }
        // },
        translations: { //put here all translations explicitly - deck ids
            type: 'array',
            items: {
                type: 'object',
                properties: {
                    language: {
                        type: 'string'
                    },
                    slide_id: objectid
                }
            }
        },
        translated_from: { //if this slide is a result of translation
            type: 'object',
            properties: {
                status: {
                    type: 'string',
                    enum: ['original', 'google', 'revised', null]
                },
                source: {
                    type: 'object',
                    properties: {
                        id: {
                            type: 'number'
                        },
                        revision: {
                            type: 'number'
                        }
                    }
                },
                translator: {
                    type: 'object',
                    properties: {
                        id: {
                            type: 'number',
                        },
                        username:{
                            type: 'string'
                        }
                    }
                }
            }
        },
        // position: {
        //     type: 'number',
        //     minimum: 1
        // },
        timestamp: {
            type: 'string',
            format: 'date-time'
        },
        revisions: {
            type: 'array',
            items: slideRevision
        },

        //active: objectid,
        datasource: {
            type: 'string'
        },
        lastUpdate: {
            type: 'string',
            format: 'date-time'
        }
    },
    required: ['user']
};

//export
module.exports = ajv.compile(slide);
