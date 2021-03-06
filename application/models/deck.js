'use strict';

//require
const _ = require('lodash');

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

// needed for tracking changes in decks properties
const trackedDeckProperties = {
    license: {
        type: 'string',
        enum: [ 'CC0', 'CC BY', 'CC BY-SA' ]
    },
    description: {
        type: 'string'
    },

};

// needed for tracking changes in deck revisions properties
const trackedDeckRevisionProperties = {
    title: {
        type: 'string'
    },
    language: {
        type: 'string'
    },

    //NOTE: temporarily store themes with their name
    theme: {
        type: 'string',
    },

    tags: {
        type: 'array',
        items: {
            type: 'object',
            properties: {
                tagName: {
                    type: 'string',
                },
                tagType: {
                    oneOf: [
                        {
                            type: 'string',
                            enum: [
                                'topic',
                                'slide',
                            ],
                        },
                        { type: 'null' },
                    ],
                },
                // TODO add other properties as well in sync with the tag-service
            },
        },
    },

    educationLevel: {
        oneOf: [
            { type: 'string'},
            { type: 'null' },
        ],
    },

    variants: {
        type: 'array',
        items: {
            type: 'object',
            properties: {
                title: {
                    type: 'string',
                },
                description: {
                    type: 'string',
                },
                language: {
                    type: 'string',
                },
            },
        },
    },

};

//build schema
const contentItem = {
    type: 'object',
    properties: {
        order: {
            type: 'integer',
            minimum: 1
        },
        kind: {
            type: 'string',
            enum: ['deck', 'slide']
        },
        ref: {
            type: 'object',
            properties: {
                id: objectid,
                revision: {
                    type: 'integer',
                    minimum: 1
                } //if not given use the last revision
            },
            required: ['id']
        }
    },
    required: ['kind', 'ref']
};

const editors = {
    type: 'object',
    properties: {
        groups: {
            type: 'array',
            items: {
                type: 'object',
                properties: {
                    id: {
                        type: 'number'
                    },
                    name: {
                        type: 'string'
                    },
                    joined: {
                        type: 'string',
                        format: 'date-time'
                    }
                }
            }
        },
        users: {
            type: 'array',
            items: {
                type: 'object',
                properties: {
                    id: objectid,
                    username: {
                        type: 'string'
                    },
                    joined: {
                        type: 'string',
                        format: 'date-time'
                    },
                    picture: {
                        type: 'string'
                    }
                }
            }
        }
    }
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

const deckRevision = {
    type: 'object',
    properties: _.merge({
        id: { //increment with every new revision
            type: 'number',
            minimum: 1
        },
        timestamp: {
            type: 'string',
            format: 'date-time'
        },
        lastUpdate: {
            type: 'string',
            format: 'date-time'
        },
        user: objectid,
        originRevision: {
            type: 'integer',
        },
        parent: {
            type: 'object',
            // properties: {
            //     id: {
            //         type: 'integer'
            //     },
            //     revision: {
            //         type: 'integer'
            //     }
            // }
        },
        popularity: {
            type: 'number',
            minimum: 0
        },
        comment: {
            type: 'string'
        },
        abstract: {
            type: 'string'
        },
        footer: {
            type: 'string'
        },
        // license: {
        //     type: 'string',
        //     enum: ['CC0', 'CC BY', 'CC BY-SA']
        // },
        isFeatured: {
            type: 'number'
        },
        priority: {
            type: 'number'
        },
        visibility: {
            type: 'boolean'
        },
        allowMarkdown: {
            type: 'boolean'
        },
        translation: {
            type: 'object',
            properties: {
                status: {
                    type: 'string',
                    enum: ['original', 'google', 'revised']
                },
                source: {
                    type: 'object'
                }
            }
        },
        preferences: {
            type: 'array',
            items: {
                type: 'object'
            }
        },
        contentItems: {
            type: 'array',
            items: contentItem
        },
        dataSources: {
            type: 'array',
            items: dataSource
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
        }
    }, trackedDeckRevisionProperties),
    required: ['id', 'timestamp', 'user']
};

const deck = {
    type: 'object',
    properties: _.merge({
        timestamp: {
            type: 'string',
            format: 'date-time'
        },
        user: objectid,

        // marks a deck so that it's not listed in either the user's decks page or search results
        hidden: {
            type: 'boolean',
            default: false,
        },

        // // TODO include these here after validation is fixed across the service
        // accessLevel: {
        //     type: 'string',
        //     enum: ['public', 'restricted', 'private']
        // },
        // editors: editors,

        // points to fork origin (only for forked decks)
        origin: {
            type: 'object',
            properties: {
                id: {
                    type: 'number',
                },
                revision: {
                    type: 'number',
                },
                title: {
                    type: 'string',
                },
                user: {
                    type: 'integer',
                },
                kind: {
                    type: 'string'
                }
            },
            required: ['id', 'revision'],
        },

        // default slide dimensions (in pixels)
        slideDimensions: {
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

        // kind: {
        //     type: 'string'
        // },
        // language: {
        //     type: 'string'
        // },
        // translation: {
        //     type: 'object'
        // },
        lastUpdate: {
            type: 'string',
            format: 'date-time'
        },

        revisions: {
            type: 'array',
            items: deckRevision
        },

        active: {
            type: 'integer'
        },
        datasource: {
            type: 'string'
        },
        translations: { //put here all translations explicitly - deck ids
            type: 'array',
            items: {
                type: 'object',
                properties: {
                    language: {
                        type: 'string'
                    },
                    deck_id: objectid
                }
            }
        },
        // TODO re-add some validation here after it is fixed on the service level, AND translation info schema is used
        // translated_from: { //if this deck is a result of translation
        //     type: 'object',
        //     properties: {
        //         status: {
        //             type: 'string',
        //             enum: ['original', 'google', 'revised', null]
        //         },
        //         source: {
        //             type: 'object',
        //             properties: {
        //                 id: {
        //                     type: 'number'
        //                 },
        //                 revision: {
        //                     type: 'number'
        //                 }
        //             }
        //         },
        //         translator: {
        //             type: 'object',
        //             properties: {
        //                 id: {
        //                     type: 'number',
        //                 },
        //                 username:{
        //                     type: 'string'
        //                 }
        //             }
        //         }
        //     }
        // }
    }, trackedDeckProperties),
    required: ['timestamp', 'user']
};

//export
module.exports = { validateDeck: ajv.compile(deck), trackedDeckProperties, trackedDeckRevisionProperties };
