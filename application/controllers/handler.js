/*
Handles the requests by executing stuff and replying to the client. Uses promises to get stuff done.
*/



'use strict';

const boom = require('boom'),
    slideDB = require('../database/slideDatabase'),
    deckDB = require('../database/deckDatabase'),
    co = require('../common'),
    Joi = require('joi'),
    async = require('async'),
    Microservices = require('../configs/microservices'),
    requestLib = require('request'),
    config = require('../configuration');

const slidetemplate = '<div class="pptx2html" style="position: relative; width: 960px; height: 720px;">'+
        '<div _id="2" _idx="undefined" _name="Title 1" _type="title" class="block content v-mid" style="position: absolute; top: 38.3334px; left: 66px; width: 828px; height: 139.167px; z-index: 23488;">'+
        '<h3 class="h-mid"><span class="text-block" style="color: #000; font-size: 44pt; font-family: Calibri Light; font-weight: initial; font-style: normal; text-decoration: initial; vertical-align: ;">Title</span></h3>'+
        '</div>'+
        ''+
        '<div _id="3" _idx="1" _name="Content Placeholder 2" _type="body" class="block content v-up" style="position: absolute; top: 191.667px; left: 66px; width: 828px; height: 456.833px; z-index: 23520;">'+
        '<ul>'+
        '	<li class="h-left" style="text-align: left;"><span class="text-block" style="color: #000; font-size: 28pt; font-family: Calibri; font-weight: initial; font-style: normal; text-decoration: initial; vertical-align: ;">Text bullet 1</span></li>'+
        '	<li class="h-left" style="text-align: left;"><span class="text-block" style="color: #000; font-size: 28pt; font-family: Calibri; font-weight: initial; font-style: normal; text-decoration: initial; vertical-align: ;">Text bullet 2</span></li>'+
        '</ul>'+
        ''+
        '<div class="h-left">&nbsp;</div>'+
        '</div>'+
        '</div>';

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
                let content = inserted.ops[0].revisions[0].content, user = request.payload.user, slideId = inserted.ops[0]._id+'-'+1;
                if(content === ''){
                    content = '<h2>'+inserted.ops[0].revisions[0].title+'</h2>';
                    //for now we use hardcoded template for new slides
                    content = slidetemplate;
                }
                createThumbnail(content, slideId, user);

                reply(co.rewriteID(inserted.ops[0]));
            }
        }).catch((error) => {
            request.log('error', error);
            reply(boom.badImplementation());
        });
    },

    updateSlide: function(request, reply) {
        //NOTE shall the payload and/or response be cleaned or enhanced with values?

        //console.log(request);
        let slideId = request.params.id;
        //must handle changes here.
        //console.log('request payload', request.payload);
        //if(true) reply(true);
        module.exports.handleChange({'params': {'id':request.payload.root_deck}, 'query': {'user': request.payload.user, 'root_deck': request.payload.top_root_deck}}
        ,(changeset) => {
            //console.log('changeset', changeset);
            if(changeset && changeset.hasOwnProperty('target_deck')){
                //revisioning took place, we must update root deck
                request.payload.root_deck = changeset.target_deck;
            }
            //console.log('new payload', request.payload);
            slideDB.replace(encodeURIComponent(slideId), request.payload).then((replaced) => {
                if (co.isEmpty(replaced.value))
                    throw replaced;
                else{
                    //we must update all decks in the 'usage' attribute
                    slideDB.get(replaced.value._id).then((newSlide) => {

                        //only update the root deck, i.e., direct parent

                        deckDB.updateContentItem(newSlide, '', request.payload.root_deck, 'slide');
                        newSlide.revisions = [newSlide.revisions[newSlide.revisions.length-1]];
                        let content = newSlide.revisions[0].content, user = request.payload.user, newSlideId = newSlide._id+'-'+newSlide.revisions[0].id;
                        if(content === ''){
                            content = '<h2>'+newSlide.revisions[0].title+'</h2>';
                            //for now we use hardcoded template for new slides
                            content = slidetemplate;
                        }
                        createThumbnail(content, newSlideId, user);
                        if(changeset && changeset.hasOwnProperty('target_deck')){
                            changeset.new_revisions.push(newSlideId);
                            newSlide.changeset = changeset;
                        }
                        reply(newSlide);

                    }).catch((error) => {
                        request.log('error', error);
                        reply(boom.badImplementation());
                    });

                  //reply(replaced.value);
                }
            }).catch((error) => {
                request.log('error', error);
                reply(boom.badImplementation());
            });
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
        slideDB.get(encodeURIComponent(request.params.id.split('-')[0]), request.payload).then((slide) => {
            if (co.isEmpty(slide))
                throw slide;
            else{
                let revision_id = parseInt(request.payload.revision_id);
                deckDB.updateContentItem(slide, revision_id, request.payload.root_deck, 'slide')
                .then((updatedIds) => {
                    let fullId = request.params.id;
                    if(fullId.split('-').length < 2){
                        fullId += '-'+updatedIds.old_revision;
                    }
                    slideDB.updateUsage(fullId, revision_id, request.payload.root_deck).then((updatedSlide) => {
                        let revisionArray = [updatedSlide.revisions[revision_id-1]];
                        updatedSlide.revisions = revisionArray;
                        reply(updatedSlide);
                    });

                });

            }
        }).catch((error) => {
            request.log('error', error);
            reply(boom.badImplementation());
        });
    },

    saveDataSources: function(request, reply) {
        let slideId = request.params.id;

        slideDB.saveDataSources(encodeURIComponent(slideId), request.payload.dataSources).then((replaced) => {
            //console.log('updated: ', replaced);
            reply(replaced);
        }).catch((error) => {
            request.log('error', error);
            reply(boom.badImplementation());
        });
    },

    getDeck: function(request, reply) {
        deckDB.get(encodeURIComponent(request.params.id)).then((deck) => {
            if (co.isEmpty(deck))
                reply(boom.notFound());
            else {
                //create data sources array
                //console.log(deck);
                const deckIdParts = request.params.id.split('-');
                const deckRevisionId = (deckIdParts.length > 1) ? deckIdParts[deckIdParts.length - 1] : deck.active;

                if (deck.revisions !== undefined && deck.revisions.length > 0 && deck.revisions[0] !== null) {
                    let deckRevision = deck.revisions.find((revision) => String(revision.id) === String(deckRevisionId));
                    if (deckRevision !== undefined) {
                        //add language of the active revision to the deck
                        if (deckRevision.language){
                            deck.language = deckRevision.language.length === 2 ? deckRevision.language : deckRevision.language.substring(0, 2);
                        }else{
                            deck.language = 'en';
                        }
                        let dataSources = [];
                        if (deckRevision.contentItems !== undefined) {
                            let arrayOfSlidePromisses = [];
                            deckRevision.contentItems.forEach((contentItem) => {
                                if (contentItem.kind === 'slide') {
                                    const slideId = contentItem.ref.id;
                                    const slideRevisionId = contentItem.ref.revision;
                                    let promise = slideDB.get(encodeURIComponent(slideId)).then((slide) => {
                                        if (slide.revisions !== undefined && slide.revisions.length > 0 && slide.revisions[0] !== null) {
                                            let slideRevision = slide.revisions.find((revision) =>  String(revision.id) ===  String(slideRevisionId));
                                            if (slideRevision !== undefined && slideRevision.dataSources!==null && slideRevision.dataSources !== undefined) {
                                                const slideRevisionTitle = slideRevision.title;
                                                slideRevision.dataSources.forEach((dataSource) => {
                                                    //check if dataSource is unique
                                                    let unique = true;
                                                    for (let i = 0; i < dataSources.length; i++) {
                                                        let dataSourceInArray = dataSources[i];
                                                        if (dataSourceInArray.type === dataSource.type &&
                                                            dataSourceInArray.title === dataSource.title &&
                                                            dataSourceInArray.url === dataSource.url &&
                                                            dataSourceInArray.comment === dataSource.comment &&
                                                            dataSourceInArray.authors === dataSource.authors) {

                                                            unique = false;
                                                            break;
                                                        }
                                                    }
                                                    if (unique) {
                                                        dataSource.sid = slideId + '-' + slideRevisionId;
                                                        dataSource.stitle = slideRevisionTitle;
                                                        dataSources.push(dataSource);
                                                    }
                                                });
                                            }
                                        }
                                    }).catch((error) => {
                                        request.log('error', error);
                                        reply(boom.badImplementation());
                                    });
                                    arrayOfSlidePromisses.push(promise);
                                }
                            });
                            Promise.all(arrayOfSlidePromisses).then(() => {
                                deckRevision.dataSources = dataSources;
                                reply(deck);
                            }).catch((error) => {
                                request.log('error', error);
                                reply(boom.badImplementation());
                            });
                        } else {
                            deckRevision.dataSources = [];
                            reply(deck);
                        }
                    } else {
                        reply(deck);
                    }
                } else {
                    reply(deck);
                }
            }
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
                //console.log('inserted', inserted);

                let newSlide = {
                    'title': 'New slide',
                    'content': '',
                    //for now we use hardcoded template for new slides
                    //'content': slidetemplate,
                    //'language': 'en_EN',
                    'language': request.payload.language,
                    'license': request.payload.license,
                    //NOTE user_id should be retrieved from the frontend
                    'user': inserted.ops[0].user,
                    'root_deck': String(inserted.ops[0]._id)+'-1',
                    'position' : 1
                };

                if(request.payload.hasOwnProperty('first_slide')){
                    if(request.payload.first_slide.hasOwnProperty('content')){
                        newSlide.content = request.payload.first_slide.content;
                    }
                    if(request.payload.first_slide.hasOwnProperty('title')){
                        newSlide.title = request.payload.first_slide.title;
                    }
                    if(request.payload.first_slide.hasOwnProperty('speakernotes')){
                        newSlide.speakernotes = request.payload.first_slide.speakernotes;
                    }
                }

                //console.log('slide', newSlide);
                slideDB.insert(newSlide)
                .then((insertedSlide) => {
                    //console.log('inserted_slide', insertedSlide);
                    insertedSlide.ops[0].id = insertedSlide.ops[0]._id;
                    deckDB.insertNewContentItem(insertedSlide.ops[0], 0, newSlide.root_deck, 'slide')
                    .then((insertedContentItem) => {
                        // if(typeof request.payload.root_deck !== 'undefined')
                        //   deckDB.insertNewContentItem(inserted.ops[0], request.payload.position, request.payload.root_deck, 'deck');
                        reply(co.rewriteID(inserted.ops[0]));
                    });
                    let content = newSlide.content, user = inserted.ops[0].user, slideId = insertedSlide.ops[0].id+'-'+1;
                    if(content === ''){
                        content = '<h2>'+newSlide.title+'</h2>';
                        //for now we use hardcoded template for new slides
                        content = slidetemplate;
                    }

                    createThumbnail(content, slideId, user);
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
        if(request.payload.new_revision){
            let root_deck ;
            if(request.payload.root_deck){
                root_deck = request.payload.root_deck;
            }
            module.exports.handleChange({'params': {'id': root_deck}, 'query': {'user': request.payload.user, 'root_deck': request.payload.top_root_deck}}
            ,(changeset) => {
                //console.log('changeset', changeset);
                if(changeset && changeset.hasOwnProperty('target_deck')){
                    //revisioning took place, we must update root deck
                    request.payload.root_deck = changeset.target_deck;
                }
                deckDB.replace(encodeURIComponent(request.params.id), request.payload).then((replaced) => {
                    if (co.isEmpty(replaced.value))
                        throw replaced;
                    else{
                        deckDB.get(replaced.value._id).then((newDeck) => {
                            if(changeset && changeset.hasOwnProperty('target_deck')){
                                newDeck.changeset = changeset;
                            }
                            if(request.payload.root_deck){
                                deckDB.updateContentItem(newDeck, '', request.payload.root_deck, 'deck')
                                .then((updated) => {
                                    newDeck.revisions = [newDeck.revisions[newDeck.revisions.length-1]];
                                    reply(newDeck);
                                });
                            }
                            else{
                                //reply(replaced.value);
                                newDeck.revisions = [newDeck.revisions[newDeck.revisions.length-1]];
                                reply(newDeck);
                            }
                        });

                    }
                }).catch((error) => {
                    request.log('error', error);
                    reply(boom.badImplementation());
                });
            });

        }
        else{
            deckDB.update(encodeURIComponent(request.params.id), request.payload).then((replaced) => {
                if (co.isEmpty(replaced.value))
                    throw replaced;
                else
                reply(replaced.value);
            }).catch((error) => {
                request.log('error', error);
                reply(boom.badImplementation());
            });
        }

    },

    forkDeckRevision: function(request, reply) {
        //NOTE shall the payload and/or response be cleaned or enhanced with values?
        deckDB.get(encodeURIComponent(request.params.id)).then((existingDeck) => {
            let ind = existingDeck.revisions.length-1;
            let payload = {
                title: existingDeck.revisions[ind].title,
                description: existingDeck.description,
                language: existingDeck.revisions[ind].language,
                tags: existingDeck.revisions[ind].tags,
                license: existingDeck.license,
                user: request.payload.user,
                fork: true
            };
            //console.log(payload);
            deckDB.replace(encodeURIComponent(request.params.id), payload).then((replaced) => {
                if (co.isEmpty(replaced.value))
                    throw replaced;
                else{
                    deckDB.get(replaced.value._id).then((newDeck) => {
                        newDeck.revisions = [newDeck.revisions[newDeck.revisions.length-1]];
                        reply(newDeck);
                    });
                }
            }).catch((error) => {
                request.log('error', error);
                reply(boom.badImplementation());
            });
        });

    },

    // revertDeckRevision: function(request, reply) {
    //     deckDB.revert(encodeURIComponent(request.params.id), request.payload).then((reverted) => {
    //         if (co.isEmpty(reverted))
    //             throw reverted;
    //         else{
    //             if(reverted.value.deck !== null){
    //                 deckDB.updateContentItem(reverted.value, parseInt(request.payload.revision_id), reverted.value.deck, 'deck');
    //             }
    //             reply(reverted);
    //         }
    //     }).catch((error) => {
    //         request.log('error', error);
    //         reply(boom.badImplementation());
    //     });
    // },

    revertDeckRevision: function(request, reply) {
        if(request.payload.root_deck === null || !request.payload.hasOwnProperty('root_deck') || request.payload.root_deck.split('-')[0] === request.params.id.split('-')[0] ){
            deckDB.revert(encodeURIComponent(request.params.id), request.payload).then((reverted) => {
                if (co.isEmpty(reverted))
                    throw reverted;
                else{
                    reverted.value.revisions = [reverted.value.revisions[parseInt(request.payload.revision_id)-1]];
                    reply(reverted.value);
                }
            }).catch((error) => {
                request.log('error', error);
                reply(boom.badImplementation());
            });
        }
        else{
            deckDB.get(encodeURIComponent(request.params.id.split('-')[0]), request.payload).then((deck) => {
                if (co.isEmpty(deck))
                    throw deck;
                else{
                    let revision_id = parseInt(request.payload.revision_id);
                    deckDB.updateContentItem(deck, revision_id, request.payload.root_deck, 'deck')
                    .then((updatedIds) => {
                        let fullId = request.params.id;
                        if(fullId.split('-').length < 2){
                            fullId += '-'+updatedIds.old_revision;
                        }
                        deckDB.updateUsage(fullId, revision_id, request.payload.root_deck).then((updatedDeck) => {
                            let revisionArray = [updatedDeck.revisions[revision_id-1]];
                            updatedDeck.revisions = revisionArray;
                            reply(updatedDeck);
                        });

                    });

                }
            }).catch((error) => {
                request.log('error', error);
                reply(boom.badImplementation());
            });
        }

    },

    //decktree
    getDeckTree: function(request, reply) {
        deckDB.getDeckTreeFromDB(request.params.id)
        .then((deckTree) => {
            if (co.isEmpty(deckTree))
                reply(boom.notFound());
            else{
                reply(deckTree);
            }
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
                    parentID = request.payload.selector.sid;
                }

                let slideArrayPath = spathArray[spathArray.length-1].split(':');
                slidePosition = parseInt(slideArrayPath[1])+1;
                let slideRevision = parseInt(request.payload.nodeSpec.id.split('-')[1])-1;
                module.exports.getSlide({'params' : {'id' : request.payload.nodeSpec.id.split('-')[0]}}, (slide) => {
                    //console.log('inserting slide', slide);
                    if(request.payload.nodeSpec.id === request.payload.selector.sid){
                        //we must duplicate the slide
                        let duplicateSlide = slide;
                        if(spathArray.length <= 1)
                            parentID = request.payload.selector.id;
                        //console.log('here');
                        duplicateSlide.parent = request.payload.nodeSpec.id;
                        duplicateSlide.comment = 'Duplicate slide of ' + request.payload.nodeSpec.id;
                        //copy the slide to a new duplicate
                        slideDB.copy(duplicateSlide, slideRevision)
                        .then((insertedDuplicate) => {
                            //console.log('parentID', parentID);
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
                        //NOTE must also update usage
                        slide.id = slide._id;
                        //console.log(request.payload.selector);
                        module.exports.handleChange({'params': {'id':parentID}, 'query': {'user': request.payload.user, 'root_deck': request.payload.selector.id}}
                        ,(changeset) => {
                          //console.log('changeset', changeset);
                            if(changeset && changeset.hasOwnProperty('target_deck')){
                              //revisioning took place, we must update root deck
                                parentID = changeset.target_deck;
                            }
                            deckDB.insertNewContentItem(slide, slidePosition, parentID, 'slide', slideRevision+1);
                            node = {title: slide.revisions[slideRevision].title, id: slide.id+'-'+slide.revisions[slideRevision].id, type: 'slide'};
                            //NOTE must update usage of newly inserted slide
                            //TODO not tested
                            slideDB.addToUsage({ref:{id:slide._id, revision: slideRevision+1}, kind: 'slide'}, parentID.split('-'));
                            if(changeset && changeset.hasOwnProperty('target_deck')){
                                node.changeset = changeset;
                            }
                            reply(node);
                        });

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

                //handle revisioning here
                //console.log(request.payload.selector);
                module.exports.handleChange({'params': {'id':parentID}, 'query': {'user': request.payload.user, 'root_deck': request.payload.selector.id}}
                ,(changeset) => {
                  //console.log('changeset', changeset);
                    if(changeset && changeset.hasOwnProperty('target_deck')){
                      //revisioning took place, we must update root deck
                        parentID = changeset.target_deck;
                    }
                    module.exports.getDeck({'params': {'id':parentID}}, (parentDeck) => {
                        //NOTE we should call /slide/new
                        let slide = {
                            'title': 'New slide', //NOTE add title
                            //'content': '',
                            //for now we use hardcoded template for new slides
                            'content': slidetemplate,
                            //'language': 'en_EN',
                            'language': parentDeck.revisions[0].language,
                            'license': parentDeck.license,
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
                        if(request.payload.hasOwnProperty('speakernotes')){
                            slide.speakernotes = request.payload.speakernotes;
                        }

                        //NOTE update positions accordingly
                        module.exports.newSlide({'payload' : slide}, (createdSlide) => {
                            node = {title: createdSlide.revisions[0].title, id: createdSlide.id+'-'+createdSlide.revisions[0].id, type: 'slide'};
                            deckDB.insertNewContentItem(createdSlide, slidePosition, parentID, 'slide');
                            //we have to return from the callback, else empty node is returned because it is updated asynchronously
                            if(changeset && changeset.hasOwnProperty('target_deck')){
                                node.changeset = changeset;
                            }
                            reply(node);
                        });
                    });


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
                    parentID = request.payload.selector.sid;
                }

                let deckArrayPath = spathArray[spathArray.length-1].split(':');
                deckPosition = parseInt(deckArrayPath[1])+1;
                let deckRevision = parseInt(request.payload.nodeSpec.id.split('-')[1])-1;

                module.exports.getDeck({'params': {'id' : request.payload.nodeSpec.id}}, (deck) => {
                    deck.id = deck._id;
                    module.exports.handleChange({'params': {'id':parentID}, 'query': {'user': request.payload.user, 'root_deck': request.payload.selector.id}}
                    ,(changeset) => {
                      //console.log('changeset', changeset);
                        if(request.payload.selector.stype === 'deck'){
                            parentID = request.payload.selector.sid;
                        }
                        else{
                            parentID = request.payload.selector.id;
                        }

                        if(changeset && changeset.hasOwnProperty('target_deck')){
                          //revisioning took place, we must update root deck
                            parentID = changeset.target_deck;
                        }
                        console.log('parentID', parentID);
                        console.log('deckPosition', deckPosition);
                        deckDB.insertNewContentItem(deck, deckPosition, parentID, 'deck', deckRevision+1);
                        //TODO not tested update usage
                        deckDB.addToUsage({ref:{id:deck._id, revision: deckRevision+1}, kind: 'deck'}, parentID.split('-'));
                        //we have to return from the callback, else empty node is returned because it is updated asynchronously
                        module.exports.getDeckTree({'params': {'id' : deck.id}}, (deckTree) => {
                            if(changeset && changeset.hasOwnProperty('target_deck')){
                                deckTree.changeset = changeset;
                            }
                            reply(deckTree);
                        });
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

                module.exports.handleChange({'params': {'id':parentID}, 'query': {'user': request.payload.user, 'root_deck': request.payload.selector.id}}
                ,(changeset) => {
                  //console.log('changeset', changeset);
                    if(changeset && changeset.hasOwnProperty('target_deck')){
                      //revisioning took place, we must update root deck
                        parentID = changeset.target_deck;
                    }
                    module.exports.getDeck({'params': {'id':parentID}}, (parentDeck) => {
                        //NOTE we should call /slide/new
                        let deck = {
                            'description': '',
                            'title': 'New deck', //NOTE add title
                            //'content': '',
                            //for now we use hardcoded template for new slides
                            'content': slidetemplate,
                            'language': parentDeck.revisions[0].language,
                            'license': parentDeck.license,
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
                                if(changeset && changeset.hasOwnProperty('target_deck')){
                                    deckTree.changeset = changeset;
                                }
                                reply(deckTree);
                            });

                        });
                    });

                });



            }
        }
        //----mockup:end
        //reply(node);
    },

    renameDeckTreeNode: function(request, reply) {
        //NOTE check if it is deck or slide
        //console.log('request', request.payload);

        if(request.payload.selector.stype === 'deck'){
            let root_deck = request.payload.selector.sid;
            module.exports.handleChange({'params': {'id':request.payload.selector.sid}, 'query': {'user': request.payload.user, 'root_deck': request.payload.selector.id}}
            ,(changeset) => {
              //console.log('changeset', changeset);
                if(changeset && changeset.hasOwnProperty('target_deck')){
                  //revisioning took place, we must update root deck
                    root_deck = changeset.target_deck;
                }
                deckDB.rename(encodeURIComponent(root_deck), request.payload.name).then((renamed) => {
                    if (co.isEmpty(renamed.value))
                        throw renamed;
                    else{
                        let response = {'title' : renamed.value};
                        if(changeset && changeset.hasOwnProperty('target_deck')){
                            response.changeset = changeset;
                        }
                        reply(response);
                    }

                }).catch((error) => {
                    request.log('error', error);
                    reply(boom.badImplementation());
                });
            });

        }else {
            let root_deck ;
            let slide_id = request.payload.selector.sid;
            let spath = request.payload.selector.spath;
            let spathArray = spath.split(';');
            if(spathArray.length > 1){
                let parentArrayPath = spathArray[spathArray.length-2].split(':');
                root_deck = parentArrayPath[0];
                //parentPosition = parentArrayPath[1];
            }
            else{
                root_deck = request.payload.selector.id;
            }
            //we must create a new slide revision as well, because of renaming it
            module.exports.getSlide({'params' : {'id' : slide_id}}, (slide) => {
              //console.log('existing', slide);

                let new_slide = {
                    'title' : request.payload.name,
                    'content' : slide.revisions[0].content,
                    'speakernotes' : slide.revisions[0].speakernotes,
                    'user' : request.payload.user,
                    'root_deck' : root_deck,
                    'top_root_deck' : request.payload.selector.id,
                    'language' : slide.language,
                    'license' : slide.license,
                    'tags' : slide.revisions[0].tags
                };
                if(new_slide.speakernotes === null){
                    new_slide.speakernotes = '';
                }
                if(new_slide.tags === null){
                    new_slide.tags = [];
                }
                let new_request = {'params' : {'id' :encodeURIComponent(slide_id)}, 'payload' : new_slide};
                module.exports.updateSlide(new_request, (updated) => {
                    reply(updated);
                });
            });

          // module.exports.handleChange({'params': {'id': root_deck}, 'query': {'user': request.payload.user, 'root_deck': request.payload.selector.id}}
          // ,(changeset) => {
          //   //console.log('changeset', changeset);
          //     if(changeset && changeset.hasOwnProperty('target_deck')){
          //       //revisioning took place, we must update root deck
          //         root_deck = changeset.target_deck;
          //     }
          //     //should we create a new revision of the slide to be renamed?
          //
          //     slideDB.rename(encodeURIComponent(request.payload.selector.sid), request.payload.name).then((renamed) => {
          //         if (co.isEmpty(renamed.value))
          //             throw renamed;
          //         else
          //         reply(renamed.value);
          //     }).catch((error) => {
          //         request.log('error', error);
          //         reply(boom.badImplementation());
          //     });
          //   });

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

        module.exports.handleChange({'params': {'id': parentID}, 'query': {'user': request.payload.user, 'root_deck': request.payload.selector.id}}
        ,(changeset) => {
          //console.log('changeset', changeset);
            if(changeset && changeset.hasOwnProperty('target_deck')){
              //revisioning took place, we must update root deck
                parentID = changeset.target_deck;
            }
            //NOTE removes item in given position -- do we have to validate with sid ?
            deckDB.removeContentItem(itemPosition, parentID)
            .then((removed) => {
                if(!removed){
                    removed = {};
                }
                if(changeset && changeset.hasOwnProperty('target_deck')){
                    removed.changeset = changeset;
                }
                reply(removed);
            });
        });

    },

    moveDeckTreeNode: function(request, reply) {
        //console.log('original payload', request.payload);
        module.exports.deleteDeckTreeNode({'payload': {'selector' : request.payload.sourceSelector, 'user': request.payload.user}},
        (removed) => {
            let nodeSpec = {'id': request.payload.sourceSelector.sid, 'type': request.payload.sourceSelector.stype};
            let sourceParentDeck = request.payload.sourceSelector.id;
            let spathArray = request.payload.sourceSelector.spath.split(';');
            if(spathArray.length > 1){

                let parentArrayPath = spathArray[spathArray.length-2].split(':');
                sourceParentDeck = parentArrayPath[0];
                //parentPosition = parentArrayPath[1];
            }
            let targetParentDeck = request.payload.targetSelector.id;
            if(request.payload.targetSelector.spath !== ''){
                if(request.payload.targetSelector.stype === 'deck'){
                    targetParentDeck = request.payload.targetSelector.sid;
                }
                else{
                    let targetspathArray = request.payload.targetSelector.spath.split(';');
                    if(targetspathArray.length > 1){

                        let parentArrayPath = targetspathArray[targetspathArray.length-2].split(':');
                        targetParentDeck = parentArrayPath[0];
                        //parentPosition = parentArrayPath[1];
                    }
                    else{
                        let parentArrayPath = targetspathArray[targetspathArray.length-1].split(':');
                        targetParentDeck = parentArrayPath[0];
                    }
                }

            }
            //console.log('sourceParentDeck before', sourceParentDeck);
            //console.log('targetParentDeck before', targetParentDeck);
            let removed_changeset, inserted_changeset ;
            if(removed.hasOwnProperty('changeset')){
                //console.log('changeset of removed', removed.changeset);
                removed_changeset = removed.changeset;
                if(removed_changeset.hasOwnProperty('new_revisions')){
                    for(let i = 0; i < removed_changeset.new_revisions.length; i++){
                        let next_new_revision = removed_changeset.new_revisions[i];
                        if(i === 0 && removed_changeset.new_revisions[i].hasOwnProperty('root_changed')){
                            next_new_revision = removed_changeset.new_revisions[i].root_changed;
                        }
                        let next_new_revision_path = next_new_revision.split('-');
                        if(sourceParentDeck.split('-')[0] === next_new_revision_path[0]){
                            sourceParentDeck = sourceParentDeck.split('-')[0] + '-' + next_new_revision_path[1];
                        }
                        if(targetParentDeck.split('-')[0] === next_new_revision_path[0]){
                            targetParentDeck = targetParentDeck.split('-')[0] + '-' + next_new_revision_path[1];
                        }
                        if(request.payload.targetSelector.sid.split('-')[0] === next_new_revision_path[0]){
                            request.payload.targetSelector.sid = request.payload.targetSelector.sid.split('-')[0] + '-' + next_new_revision_path[1];
                        }
                        if(request.payload.targetSelector.id.split('-')[0] === next_new_revision_path[0]){
                            request.payload.targetSelector.id = request.payload.targetSelector.id.split('-')[0] + '-' + next_new_revision_path[1];
                        }
                        if(nodeSpec.id.split('-')[0] === next_new_revision_path[0]){
                            nodeSpec.id = nodeSpec.id.split('-')[0] + '-' + next_new_revision_path[1];
                        }

                    }
                }
            }
            //console.log('sourceParentDeck after', sourceParentDeck);
            //console.log('targetParentDeck after', targetParentDeck);

            let itemArrayPath = spathArray[spathArray.length-1].split(':');
            let itemPosition = itemArrayPath[1];
            if(sourceParentDeck === targetParentDeck && parseInt(itemPosition) < request.payload.targetIndex){
                request.payload.targetIndex--;
            }
            request.payload.targetSelector.spath = request.payload.targetSelector.sid + ':' + request.payload.targetIndex;
            if(request.payload.targetSelector.id.split('-')[0] === request.payload.targetSelector.sid.split('-')[0]){
                request.payload.targetSelector.id = request.payload.targetSelector.sid;
            }
            let payload  = {'payload': {
                'selector' : request.payload.targetSelector, 'nodeSpec': nodeSpec, 'user': request.payload.user}};
            //console.log('nodeSpec', nodeSpec);
            //console.log('payload', payload);
            module.exports.createDeckTreeNode(payload,
            (inserted) => {

                // if(inserted.hasOwnProperty('changeset')){
                //     inserted_changeset = inserted.changeset;
                // }
                if(inserted.hasOwnProperty('changeset') && removed.hasOwnProperty('changeset')){
                    inserted_changeset = inserted.changeset;
                    inserted.inserted_changeset = inserted_changeset;
                    inserted.removed_changeset = removed_changeset;
                }
                else if(removed.hasOwnProperty('changeset')){
                    inserted.changeset = removed_changeset;
                }
                if(inserted.hasOwnProperty('changeset')){
                    inserted_changeset = inserted.changeset;
                    inserted.changeset = inserted_changeset;
                }
                //console.log('removed_changeset', removed_changeset);
                //console.log('inserted_changeset', inserted_changeset);

                reply(inserted);
            });
        });

    },

    getFlatSlides: function(request, reply){
        deckDB.getFlatSlidesFromDB(request.params.id, undefined)
        .then((deckTree) => {
            if (co.isEmpty(deckTree)){
                reply(boom.notFound());
            }
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
    },

    needsNewRevision: function(request, reply){
        deckDB.needsNewRevision(request.params.id, request.query.user).then((needsNewRevision) => {
            //console.log(needsNewRevision);
            reply(needsNewRevision);
        });
    },

    handleChange: function(request, reply){
        //console.log(request.query);
        if(!request.params.id){
            reply();
        }
        else{
            deckDB.get(request.params.id).then((foundDeck) => {
                let active = -1;
                let idArray = request.params.id.split('-');
                if(idArray.length > 1){
                    active = idArray[1];
                }
                else{
                    active = foundDeck.active;
                }
                request.params.id = idArray[0]+'-'+active;
                deckDB.get(request.query.root_deck).then((foundRootDeck) => {
                    let activeRoot = -1;
                    let rootIdArray = request.query.root_deck.split('-');
                    if(rootIdArray.length > 1){
                        activeRoot = rootIdArray[1];
                    }
                    else{
                        activeRoot = parseInt(foundRootDeck.active);
                    }
                    request.query.root_deck = rootIdArray[0]+'-'+activeRoot;
                    //console.log('deck', request.params.id);
                    //console.log('root_deck', request.query.root_deck);
                    module.exports.getDeckTree({'params': {'id' : request.query.root_deck}}, (decktree) => {
                        deckDB.handleChange(decktree, request.params.id, request.query.root_deck, request.query.user).then((changeSet) => {
                            //console.log(changeSet);
                            if(!changeSet){
                                throw changeSet;
                            }
                            else{
                                reply(changeSet);
                            }
                        }).catch((e) => {
                            request.log('error', e);
                            reply(boom.badImplementation());
                        });;
                    });
                }).catch((err) => {
                    request.log('error', err);
                    reply(boom.badImplementation());
                });;

            }).catch((error) => {
                request.log('error', error);
                reply(boom.badImplementation());
            });
        }


    },

    findUserById: (id) => {
        return userDB.findOneById((id), (err, found) => {
            return found.username;
        });
    },

    getAllRecent: (request, reply) => {
        deckDB.findWithLimitAndSort('decks', {}, parseInt(request.params.limit), parseInt(request.params.offset), {'timestamp': -1})
        .then((decks) => {
            if (decks.length < 1) {
                reply(boom.notFound());
                return;
            }
            let result = [];
            async.eachSeries(decks, (deck, callback) => {
                let metadata = {};
                metadata._id = deck._id;
                metadata.description = deck.description;
                metadata.countRevisions = deck.revisions.length;
                metadata.active = deck.active;
                metadata.user = deck.user;

                metadata.timestamp = deck.timestamp;
                //get revision
                let revision = deck.revisions[deck.active-1];
                metadata.title = revision.title;
                if (revision.language){
                    metadata.language = revision.language.length === 2 ? revision.language : revision.language.substring(0, 2);
                }else{
                    metadata.language = 'en';
                }
                metadata.revision_to_show = revision.id;
                deckDB.getUsernameById(deck.user) //get username
                .then((username) => {
                    metadata.username = username;
                    result.push(metadata);
                    callback();
                })
                .catch((err) => {
                    console.log(err);
                    metadata.username = null;
                    result.push(metadata);
                    callback();
                });
            }, () => {
                return reply(result);
            });
        })
        .catch((err) => {
            console.log(err);
            reply(boom.notFound());
        });
    },


    getAllFeatured: (request, reply) => {

        if(request.params.offset === 'null'){
            request.params.offset = 0;
        }
        deckDB.findWithLimit('decks', {'revisions.isFeatured': 1}, parseInt(request.params.limit), parseInt(request.params.offset))
        .then((decks) => {
            if (decks.length < 1) {
                reply([]);
                return;
            }
            let result = [];
            async.eachSeries(decks, (deck, callback) => {
                let metadata = {};
                metadata._id = deck._id;
                metadata.description = deck.description;
                metadata.countRevisions = deck.revisions.length;
                metadata.active = deck.active;
                metadata.user = deck.user;

                metadata.timestamp = deck.timestamp;
                //get revision
                let revision = {};
                for (let key in deck.revisions) {
                    if (deck.revisions[key].isFeatured === 1)
                        revision = deck.revisions[key];
                }
                metadata.title = revision.title;
                if (revision.language){
                    metadata.language = revision.language.length === 2 ? revision.language : revision.language.substring(0, 2);
                }else{
                    metadata.language = 'en';
                }
                metadata.revision_to_show = revision.id;
                deckDB.getUsernameById(deck.user) //get username
                .then((username) => {
                    metadata.username = username;
                    result.push(metadata);
                    callback();
                })
                .catch((err) => {
                    console.log(err);
                    metadata.username = null;
                    result.push(metadata);
                    callback();
                });
            }, () => {
                return reply(result);
            });
        })
        .catch((err) => {
            console.log(err);
            reply(boom.notFound());
        });
    },


    //returns metadata about all decks a user owns
    getAllDecks: (request, reply) => {
        //TODO another API for user activity is needed

        //parse userid
        let userid = request.params.userid;
        const integerSchema = Joi.number().integer();
        const validationResult = integerSchema.validate(userid);
        if (validationResult.error === null) {
            userid = validationResult.value;
        }

        let decksPromise = deckDB.find('decks', {
            user: userid
        });

        decksPromise.then((decks) => {
            //console.log('handler getAllDecks: found decks:', decks);

            if (decks.length < 1) {
                reply(boom.notFound());
                return;
            }

            let result = [];

            decks.forEach((deck) => {
                let metadata = {};
                metadata._id = deck._id;
                metadata.timestamp = deck.timestamp;
                metadata.description = deck.description;
                metadata.lastUpdate = deck.lastUpdate;
                metadata.tags = deck.tags;
                metadata.translation = deck.translation;
                metadata.countRevisions = deck.revisions.length;
                metadata.active = deck.active;

                //get revision
                let revision = {};
                for (let key in deck.revisions) {
                    if (deck.revisions[key].id === deck.active)
                        revision = deck.revisions[key];
                }

                metadata.timestamp = revision.timestamp;
                metadata.title = revision.title;
                metadata.comment = revision.comment;
                metadata.abstract = revision.abstract;
                metadata.license = revision.license;
                metadata.priority = revision.priority;
                metadata.visibility = revision.visibility;
                if (revision.language){
                    metadata.language = revision.language.length === 2 ? revision.language : revision.language.substring(0, 2);
                }else{
                    metadata.language = 'en';
                }
                metadata.translation = revision.translation;
                metadata.tags = revision.tags;
                metadata.parent = revision.parent;

                //get first slide
                let firstSlide = undefined;
                for (let key in revision.contentItems) {
                    if (revision.contentItems[key].order === 1
                      && revision.contentItems[key].kind === 'slide') {
                        firstSlide = revision.contentItems[key].ref.id;
                        if (revision.contentItems[key].ref.revision)
                            firstSlide += '-' + revision.contentItems[key].ref.revision;
                    }
                };
                metadata.firstSlide = firstSlide;

                result.push(metadata);
            });

            return reply(result);

        });
    },

    countDeckRevisions: function(request, reply){
        deckDB.get(request.params.id.split('-')[0]).then((foundDeck) => {
            if(!foundDeck){
                reply(boom.notFound());
            }
            else{
                reply(foundDeck.revisions.length);
            }
        });
    },

    countSlideRevisions: function(request, reply){
        slideDB.get(request.params.id.split('-')[0]).then((foundSlide) => {
            if(!foundSlide){
                reply(boom.notFound());
            }
            else{
                reply(foundSlide.revisions.length);
            }
        });
    },

    countSlides: function(request, reply){
        deckDB.get(request.params.id).then((foundDeck) => {
            if(!foundDeck){
                reply(boom.notFound());
            }
            else{
                let activeRevision = 1;
                if(request.params.id.split('-').length > 1){
                    activeRevision = parseInt(request.params.id.split('-')[1]);
                }
                let slideCount = 0;
                for(let i = 0; i < foundDeck.revisions[activeRevision-1].contentItems.length; i++){
                    if(foundDeck.revisions[activeRevision-1].contentItems[i].kind === 'slide'){
                        slideCount++;
                    }
                }
                reply(slideCount);
            }
        });
    },

    validateAuthorizationForDeck: (request, reply) => {
        let deckid = request.params.id;

        return deckDB.get(deckid)
            .then((result) => {
                // console.log('validateAuthorizationForDeck: deckid, deck:', deckid, result);
                if (result === null || result === undefined || result._id === undefined)
                    return reply(boom.notFound());

                //handle if no revision is given (result is a deck)
                if (result.revisions) {
                    result = result.revisions.filter((el) => {
                        return el.id === result.active;
                    }) || [{}];
                    result = result[0];
                }

                return isUserAllowedToEditTheDeck(request, result)
                    .then((isAllowed) => {
                        return reply({allowed: isAllowed});
                    })
                    .catch((error) => {
                        console.log('Error', error);
                        return reply(boom.badImplementation());
                    });
            })
            .catch((error) => {
                console.log('Error', error);
                return reply(boom.badImplementation());
            });
    }
};

function createThumbnail(slideContent, slideId, user) {
    let http = require('http');
    let he = require('he');

    let encodedContent = he.encode(slideContent, {allowUnsafeSymbols: true});

    let jsonData = {
        userID: String(user),
        html: encodedContent,
        filename: slideId
    };

    let data = JSON.stringify(jsonData);

    let options = {
        host: Microservices.image.uri,
        port: Microservices.image.port,
        path: '/thumbnail',
        method: 'POST',
        headers : {
            'Content-Type': 'application/json',
            'Cache-Control': 'no-cache',
            'Content-Length': data.length
        }
    };
    let req = http.request(options, (res) => {
        // console.log('STATUS: ' + res.statusCode);
        // console.log('HEADERS: ' + JSON.stringify(res.headers));
        res.setEncoding('utf8');
        res.on('data', (chunk) => {
        // console.log('Response: ', chunk);
        // let newDeckTreeNode = JSON.parse(chunk);

        // resolve(newDeckTreeNode);
        });
    });
    req.on('error', (e) => {
        console.log('problem with request thumb: ' + e.message);
        // reject(e);
    });
    req.write(data);
    req.end();

    //console.log(slideId);
}

//Checks with the user data and the deck revision, if the user is allowed to edit the deck
function isUserAllowedToEditTheDeck(request, deckRevision) {
    const JWT = request.auth.token;
    const accessLevel = deckRevision.accessLevel || 'public';
    if (deckRevision.editors === undefined)
        deckRevision.editors = {
            users: [],
            groups: []
        };
    const users = deckRevision.editors.users || [];
    const groups = deckRevision.editors.groups || [];

    console.log('isUserAllowedToEditTheDeck: accessLevel, userid:', accessLevel, ',', request.auth.credentials.userid);

    let promise = new Promise((resolve, reject) => {
        if (deckRevision === {})
            return resolve(false);

        if (accessLevel === 'public')
            return resolve(true);

        if (deckRevision.user === request.auth.credentials.userid)
            return resolve(true);

        if (accessLevel === 'private') {
            return resolve(false);
        }

        let isUserAnAuthorizedUser = (users.findIndex((user) => {
            return user.id === request.auth.credentials.userid;
        }) !== -1);

        if (isUserAnAuthorizedUser)
            return resolve(true);

        let header = {};
        header[config.JWT.HEADER] = JWT;
        const options = {
            url: Microservices.user.uri + ':' + Microservices.user.port + '/userdata',
            method: 'GET',
            json: true,
            headers: header
        };

        function callback(error, response, body) {
            console.log('/userdata: ', error, response.statusCode, body);

            if (!error && (response.statusCode === 200)) {
                if (body.groups === undefined || body.groups.length < 1)
                    body.groups = [];

                isUserAnAuthorizedUser = isUserAnAuthorizedUser || ( groups.findIndex((group) => {
                    return (body.groups.findIndex((group2) => {
                        return group2._id === group.id;
                    }) !== -1);
                }) !== -1 );

                resolve(isUserAnAuthorizedUser);
            } else {
                if (response.statusCode === 404)
                    return resolve(false);  //user not found
                return reject(error);
            }
        }

        requestLib(options, callback);
    });
    return promise;
}
