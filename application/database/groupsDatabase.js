'use strict';

const helper = require('./helper');
const validateGroup = require('../models/group');

function getGroupsCollection(){
    return helper.connectToDatabase()
        .then((db) => db.collection('groups'));
}

function getNextId(){
    return helper.connectToDatabase()
    .then((db) => helper.getNextIncrementationValueForCollection(db, 'groups'));
}

let self = module.exports = {

    exists: function(id) {
        return getGroupsCollection().then( (groups) => {
            return groups.find({_id : id}).hasNext();
        });
    },

    get: function(id) {
        return getGroupsCollection()
        .then((groups) => groups.findOne({
            _id: id
        }));
    },

    getDeckGroups: function(deckId, userId){
        let query = {
            decks: deckId
        };

        if(userId){
            query.user = userId;
        };

        return getGroupsCollection()
        .then((groups) => groups.find(query))
        .then((stream) => stream.toArray());
    },

    insert: function(group){
        return getNextId().then((id) => {
            return getGroupsCollection().then( (groups) => {
                group._id = id;

                let now = (new Date()).toISOString();
                group.timestamp = now;
                group.lastUpdate = now;

                if (!validateGroup(group)) {
                    throw validateGroup.errors;
                }

                return groups.insertOne(group).then( (insertedGroup) => {
                    return insertedGroup.ops[0];
                });
            });
        });
    }, 

    replaceMetadata: function(existingGroup, newMetadata){
        return getGroupsCollection()
        .then((groups) => {

            let newGroup = Object.assign({}, existingGroup);
            newGroup.lastUpdate = (new Date()).toISOString();
            newGroup.title = newMetadata.title;
            newGroup.description = newMetadata.description || '';

            return groups.findOneAndReplace( { _id: existingGroup._id }, newGroup, { returnOriginal: false });
        });
    }, 

    replaceDecks: function(existingGroup, newDecks){
        return getGroupsCollection()
        .then((groups) => {

            let newGroup = Object.assign({}, existingGroup);
            newGroup.lastUpdate = (new Date()).toISOString();
            newGroup.decks = newDecks;

            return groups.findOneAndReplace( { _id: existingGroup._id }, newGroup, { returnOriginal: false });
        });
    }, 

    delete: function(id){
        return getGroupsCollection()
        .then( (groups) => {
            return groups.remove({_id: id});
        });
    }, 

    count: function(query){
        return getGroupsCollection()
        .then( (groups) => groups.find(query).count());
    }, 

    list: function(query, pagination){

        let offset = pagination.page * pagination.per_page;
        let limit = pagination.per_page;
        let sort = { _id: 1 };      // sort with ASC _id

        return getGroupsCollection()
        .then( (groups) => groups.find(query).sort(sort).skip(offset).limit(limit))
        .then((stream) => stream.toArray());
    }, 

    userPermissions: function(groupId, userId){
        userId = parseInt(userId);

        return self.get(groupId).then( (group) => {
            if(!group) return null;

            // give all rights to group owner
            if(group.user === userId){
                return {
                    admin: true,
                    edit: true
                };
            }

            return {
                admin: false, 
                edit: false
            };
        });
    }

};
