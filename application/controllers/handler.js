/*
Handles the requests by executing stuff and replying to the client. Uses promises to get stuff done.
*/

'use strict';

const boom = require('boom'),
    slideDB = require('../database/slideDatabase'),
    deckDB = require('../database/deckDatabase'),
    co = require('../common');

let self = module.exports = {
    getSlide: function(request, reply) {
        //NOTE shall the response be cleaned or enhanced with values?
        slideDB.get(encodeURIComponent(request.params.id)).then((slide) => {
            if (co.isEmpty(slide))
                reply(boom.notFound());
            else
            //reply(co.rewriteID(slide));
            reply(slide);
        }).catch((error) => {
            request.log('error', error);
            reply(boom.badImplementation());
        });
    },

    //Get All Slides from database
    getAllSlides: function(request, reply) {
        slideDB.getAllFromCollection()
        .then((slides) => {
            slides.forEach((slide) => {
                co.rewriteID(slide);
                //activity.author = authorsMap.get(activity.user_id);//insert author data
            });

            let jsonReply = JSON.stringify(slides);
            reply(jsonReply);

        }).catch((error) => {
            request.log('error', error);
            reply(boom.badImplementation());
        });
    },

    newSlide: function(request, reply) {
        //NOTE shall the response be cleaned or enhanced with values?
        slideDB.insert(request.payload).then((inserted) => {
            if (co.isEmpty(inserted.ops) || co.isEmpty(inserted.ops[0]))
                throw inserted;
            else{
                //deckDB.insertNewContentItem(inserted.ops[0], request.payload.position, request.payload.root_deck, 'slide');
                reply(co.rewriteID(inserted.ops[0]));
            }
        }).catch((error) => {
            request.log('error', error);
            reply(boom.badImplementation());
        });
    },

    updateSlide: function(request, reply) {
        //NOTE shall the payload and/or response be cleaned or enhanced with values?
        let slideId = request.params.id;
        slideDB.replace(encodeURIComponent(slideId), request.payload).then((replaced) => {
            //console.log('updated: ', replaced.value.revisions);
            if (co.isEmpty(replaced.value))
                throw replaced;
            else{
                //let revisionUpdatedId = slideId.split('-')[1];
                //we must update all decks in the 'usage' attribute
                slideDB.get(replaced.value._id).then((newSlide) => {
                    //console.log('usage', newSlide.revisions[newSlide.revisions.length-1].usage);
                    let usageArray = newSlide.revisions[newSlide.revisions.length-1].usage;
                    for(let i = 0; i < usageArray.length; i++){
                        //console.log('usage deck: ', usageArray[i]);
                        deckDB.updateContentItem(newSlide, '', usageArray[i], 'slide');
                    }
                    newSlide.revisions = [newSlide.revisions[newSlide.revisions.length-1]];
                    reply(newSlide);

                });

                //reply(replaced.value);
            }
        }).catch((error) => {
            request.log('error', error);
            reply(boom.badImplementation());
        });
    },

    updateNoRevisionSlide: function(request, reply) {
        //NOTE shall the payload and/or response be cleaned or enhanced with values?
        let slideId = request.params.id;

        slideDB.replaceNoRevision(encodeURIComponent(slideId), request.payload).then((replaced) => {
            //console.log('updated: ', replaced);
            if (co.isEmpty(replaced))
                throw replaced;
            else{
                // slideDB.get(replaced.value._id).then((newSlide) => {
                //   deckDB.updateContentItem(newSlide, '', request.payload.root_deck, 'slide');
                // });

                reply(replaced.value);
            }
        }).catch((error) => {
            request.log('error', error);
            reply(boom.badImplementation());
        });
    },

    revertSlideRevision: function(request, reply) {
        slideDB.get(encodeURIComponent(request.params.id), request.payload).then((slide) => {
            if (co.isEmpty(slide))
                throw slide;
            else{
                deckDB.updateContentItem(slide, parseInt(request.payload.revision_id), request.payload.root_deck, 'slide');
                reply(slide);
            }
        }).catch((error) => {
            request.log('error', error);
            reply(boom.badImplementation());
        });
    },

    getDeck: function(request, reply) {
        deckDB.get(encodeURIComponent(request.params.id)).then((deck) => {
            if (co.isEmpty(deck))
                reply(boom.notFound());
            else
            reply(deck);
        }).catch((error) => {
            request.log('error', error);
            reply(boom.badImplementation());
        });
    },
    newDeck: function(request, reply) {
        //NOTE shall the response be cleaned or enhanced with values?
        deckDB.insert(request.payload).then((inserted) => {
            if (co.isEmpty(inserted.ops) || co.isEmpty(inserted.ops[0]))
                throw inserted;
            else{
                //create a new slide inside the new deck

                let newSlide = {
                    'title': 'New slide',
                    'content': '',
                    'language': 'en',
                    'license': 'CC0',
                    //NOTE user_id should be retrieved from the frontend
                    'user': inserted.ops[0].user,
                    'root_deck': String(inserted.ops[0]._id)+'-1',
                    'position' : 1
                };
                slideDB.insert(newSlide)
                .then((insertedSlide) => {
                    insertedSlide.ops[0].id = insertedSlide.ops[0]._id;
                    deckDB.insertNewContentItem(insertedSlide.ops[0], 0, newSlide.root_deck, 'slide')
                    .then((insertedContentItem) => {
                        // if(typeof request.payload.root_deck !== 'undefined')
                        //   deckDB.insertNewContentItem(inserted.ops[0], request.payload.position, request.payload.root_deck, 'deck');
                        reply(co.rewriteID(inserted.ops[0]));
                    });

                });
                //check if a root deck is defined, if yes, update its content items to reflect the new sub-deck

            }
        }).catch((error) => {
            request.log('error', error);
            reply(boom.badImplementation());
        });
    },

    updateDeck: function(request, reply) {
        //NOTE shall the payload and/or response be cleaned or enhanced with values?
        //or should be deckDB.replace?
        let deckId = request.params.id;
        deckDB.update(encodeURIComponent(deckId.split('-')[0]), request.payload).then((replaced) => {
            //console.log('updated: ', replaced);
            if (co.isEmpty(replaced.value))
                throw replaced;
            else
            reply(replaced.value);
        }).catch((error) => {
            request.log('error', error);
            reply(boom.badImplementation());
        });
    },

    updateDeckRevision: function(request, reply) {
        //NOTE shall the payload and/or response be cleaned or enhanced with values?
        deckDB.replace(encodeURIComponent(request.params.id), request.payload).then((replaced) => {
            if (co.isEmpty(replaced.value))
                throw replaced;
            else{
                if(request.payload.root_deck){
                    deckDB.get(replaced.value._id).then((newDeck) => {
                        deckDB.updateContentItem(newDeck, '', request.payload.root_deck, 'deck')
                        .then((updated) => {
                            reply(replaced.value);
                        });
                    });
                }
                reply(replaced.value);
            }
        }).catch((error) => {
            request.log('error', error);
            reply(boom.badImplementation());
        });
    },

    revertDeckRevision: function(request, reply) {
        deckDB.revert(encodeURIComponent(request.params.id), request.payload).then((reverted) => {
            if (co.isEmpty(reverted))
                throw reverted;
            else{
                if(reverted.value.deck !== null){
                    deckDB.updateContentItem(reverted.value, parseInt(request.payload.revision_id), reverted.value.deck, 'deck');
                }
                reply(reverted);
            }
        }).catch((error) => {
            request.log('error', error);
            reply(boom.badImplementation());
        });
    },

    //decktree
    getDeckTree: function(request, reply) {
        deckDB.getDeckTreeFromDB(request.params.id)
        .then((deckTree) => {
            reply(deckTree);
        });
    },

    createDeckTreeNode: function(request, reply) {
        //----mockup:start
        let node = {};
        //let rnd = Math.round(Math.random()*800) + 1;

        if(request.payload.nodeSpec.type === 'slide'){
            if(request.payload.nodeSpec.id && request.payload.nodeSpec.id !== '0'){
                //it means it is an existing node, we should retrieve the details then
                let spath = request.payload.selector.spath;
                let spathArray = spath.split(';');
                let parentID, parentPosition, slidePosition;
                if(spathArray.length > 1){

                    let parentArrayPath = spathArray[spathArray.length-2].split(':');
                    parentID = parentArrayPath[0];
                    parentPosition = parseInt(parentArrayPath[1]);

                }
                else{
                    parentID = request.payload.selector.id;
                }

                let slideArrayPath = spathArray[spathArray.length-1].split(':');
                slidePosition = parseInt(slideArrayPath[1])+1;
                let slideRevision = parseInt(request.payload.nodeSpec.id.split('-')[1])-1;
                module.exports.getSlide({'params' : {'id' : request.payload.nodeSpec.id.split('-')[0]}}, (slide) => {
                    if(request.payload.nodeSpec.id === request.payload.selector.sid){
                        //we must duplicate the slide
                        let duplicateSlide = slide;
                        duplicateSlide.parent = request.payload.nodeSpec.id;
                        duplicateSlide.comment = 'Duplicate slide of ' + request.payload.nodeSpec.id;
                        //copy the slide to a new duplicate
                        slideDB.copy(duplicateSlide, slideRevision)
                        .then((insertedDuplicate) => {
                            //console.log(insertedDuplicate);
                            insertedDuplicate = insertedDuplicate.ops[0];
                            insertedDuplicate.id = insertedDuplicate._id;
                            //node = {title: insertedDuplicate.revisions[slideRevision].title, id: insertedDuplicate.id+'-'+insertedDuplicate.revisions[slideRevision].id, type: 'slide'};
                            node = {title: insertedDuplicate.revisions[0].title, id: insertedDuplicate.id+'-'+insertedDuplicate.revisions[0].id, type: 'slide'};
                            deckDB.insertNewContentItem(insertedDuplicate, slidePosition, parentID, 'slide', 1);
                            reply(node);
                        });
                    }
                    else{
                        //change position of the existing slide
                        deckDB.insertNewContentItem(slide, slidePosition, parentID, 'slide', slideRevision+1);
                        node = {title: slide.revisions[slideRevision].title, id: slide.id+'-'+slide.revisions[slideRevision].id, type: 'slide'};
                        reply(node);
                    }

                });

            }else{
                //need to make a new slide
                let spath = request.payload.selector.spath;
                let spathArray = spath.split(';');
                let parentID, parentPosition, slidePosition;
                if(spathArray.length > 1){

                    let parentArrayPath = spathArray[spathArray.length-2].split(':');
                    parentID = parentArrayPath[0];
                    parentPosition = parseInt(parentArrayPath[1]);

                }
                else{
                    parentID = request.payload.selector.id;
                }
                let slideArrayPath = spathArray[spathArray.length-1].split(':');
                slidePosition = parseInt(slideArrayPath[1])+1;
                if(request.payload.selector.stype === 'deck'){
                    //selector is deck, we can get the root deck id directly
                    parentID = request.payload.selector.sid;
                    slidePosition = 0;
                }


                //NOTE we should call /slide/new
                let slide = {
                    'title': 'New slide', //NOTE add title
                    'content': '',
                    'language': 'en',
                    'license': 'CC0',
                    //NOTE user_id should be retrieved from the frontend
                    'user': request.payload.user,
                    'root_deck': parentID,
                    'position' : slidePosition
                };

                if(request.payload.hasOwnProperty('content')){
                    slide.content = request.payload.content;
                }
                if(request.payload.hasOwnProperty('title')){
                    slide.title = request.payload.title;
                }
                if(request.payload.hasOwnProperty('license')){
                    slide.license = request.payload.license;
                }

                //NOTE update positions accordingly
                module.exports.newSlide({'payload' : slide}, (createdSlide) => {
                    node = {title: createdSlide.revisions[0].title, id: createdSlide.id+'-'+createdSlide.revisions[0].id, type: 'slide'};
                    deckDB.insertNewContentItem(createdSlide, slidePosition, parentID, 'slide');
                    //we have to return from the callback, else empty node is returned because it is updated asynchronously
                    reply(node);
                });


            }
        }else{
            if(request.payload.nodeSpec.id && request.payload.nodeSpec.id !== '0'){
                //it means it is an existing node
                let spath = request.payload.selector.spath;
                let spathArray = spath.split(';');
                let parentID, parentPosition, deckPosition;
                if(spathArray.length > 1){

                    let parentArrayPath = spathArray[spathArray.length-2].split(':');
                    parentID = parentArrayPath[0];
                    parentPosition = parseInt(parentArrayPath[1]);

                }
                else{
                    parentID = request.payload.selector.id;
                }

                let deckArrayPath = spathArray[spathArray.length-1].split(':');
                deckPosition = parseInt(deckArrayPath[1])+1;
                let deckRevision = parseInt(request.payload.nodeSpec.id.split('-')[1])-1;

                module.exports.getDeck({'params': {'id' : request.payload.nodeSpec.id}}, (deck) => {
                    deckDB.insertNewContentItem(deck, deckPosition, parentID, 'deck', deckRevision+1);
                    //we have to return from the callback, else empty node is returned because it is updated asynchronously
                    module.exports.getDeckTree({'params': {'id' : deck.id}}, (deckTree) => {
                        reply(deckTree);
                    });

                });


            }else{

                //need to make a new deck

                let spath = request.payload.selector.spath;
                let spathArray = spath.split(';');
                let parentID, parentPosition, deckPosition;
                if(spathArray.length > 1){

                    let parentArrayPath = spathArray[spathArray.length-2].split(':');
                    parentID = parentArrayPath[0];
                    parentPosition = parseInt(parentArrayPath[1]);

                }
                else{
                    parentID = request.payload.selector.id;
                }
                if(request.payload.selector.stype === 'deck'){
                    parentID = request.payload.selector.sid;
                }

                let deckArrayPath = spathArray[spathArray.length-1].split(':');
                deckPosition = parseInt(deckArrayPath[1])+1;
                //NOTE we should call /slide/new
                let deck = {
                    'description': '',
                    'title': 'New deck', //NOTE add title
                    'content': '',
                    'language': 'en',
                    'license': 'CC0',
                    //NOTE user_id should be retrieved from the frontend
                    'user': request.payload.user,
                    'root_deck': parentID,
                    'position' : deckPosition
                };

                //NOTE update positions accordingly
                module.exports.newDeck({'payload' : deck}, (createdDeck) => {
                    if(typeof parentID !== 'undefined')
                        deckDB.insertNewContentItem(createdDeck, deckPosition, parentID, 'deck');
                    //we have to return from the callback, else empty node is returned because it is updated asynchronously
                    module.exports.getDeckTree({'params': {'id' : createdDeck.id}}, (deckTree) => {
                        reply(deckTree);
                    });

                });
            }
        }
        //----mockup:end
        //reply(node);
    },

    renameDeckTreeNode: function(request, reply) {
        //NOTE check if it is deck or slide
        if(request.payload.selector.stype === 'deck'){
            deckDB.rename(encodeURIComponent(request.payload.selector.sid), request.payload.name).then((renamed) => {
                if (co.isEmpty(renamed.value))
                    throw renamed;
                else
                reply(renamed.value);
            }).catch((error) => {
                request.log('error', error);
                reply(boom.badImplementation());
            });
        }else {
            slideDB.rename(encodeURIComponent(request.payload.selector.sid), request.payload.name).then((renamed) => {
                if (co.isEmpty(renamed.value))
                    throw renamed;
                else
                reply(renamed.value);
            }).catch((error) => {
                request.log('error', error);
                reply(boom.badImplementation());
            });
        }

        //reply({'msg': 'node name got updated. New node name is: ' + request.payload.name});
    },

    deleteDeckTreeNode: function(request, reply) {
        //NOTE no removal in the DB, just unlink from content items, and update the positions of the other elements
        let spath = request.payload.selector.spath;
        let spathArray = spath.split(';');
        let parentID, parentPosition, itemPosition;
        if(spathArray.length > 1){

            let parentArrayPath = spathArray[spathArray.length-2].split(':');
            parentID = parentArrayPath[0];
            parentPosition = parentArrayPath[1];

        }
        else{
            parentID = request.payload.selector.id;
        }

        let itemArrayPath = spathArray[spathArray.length-1].split(':');
        itemPosition = itemArrayPath[1];
        //NOTE removes item in given position -- do we have to validate with sid ?
        deckDB.removeContentItem(itemPosition, parentID)
        .then((removed) => {
            reply(removed);
        });
    },

    getFlatSlides: function(request, reply){
        deckDB.getFlatSlidesFromDB(request.params.id)
        .then((deckTree) => {
            if(typeof request.query.limit !== 'undefined' || typeof request.query.offset !== 'undefined'){
                let limit = request.query.limit, offset = request.query.offset;
                if(typeof limit !== 'undefined'){
                    limit = parseInt(limit);
                    if(limit < 0 || limit > deckTree.children.length || isNaN(limit))
                        limit = deckTree.children.length;
                }
                else{
                    limit = deckTree.children.length;
                }

                if(typeof offset !== 'undefined'){
                    offset = parseInt(offset);
                    if(offset < 0 || offset >= deckTree.children.length)
                        offset = 0;
                }
                else{
                    offset = 0;
                }


                let ending = parseInt(offset)+parseInt(limit);
                deckTree.children = deckTree.children.slice(offset, ending);
            }

            reply(deckTree);
        });
    },

    getEditors: function(request, reply){
        deckDB.getDeckEditors(request.params.id)
        .then((editorsList) => {
            reply(editorsList);
        });
    }
};
