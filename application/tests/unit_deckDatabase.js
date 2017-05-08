/* eslint-env mocha */
'use strict';

let chai = require('chai');
let chaiAsPromised = require('chai-as-promised');
chai.use(chaiAsPromised);

chai.should();

let helper = require('../database/helper.js');
let deckDB = require('../database/deckDatabase');

describe('deckDatabase', function() {

    beforeEach(function() {
        return helper.cleanDatabase().then(() =>
            helper.connectToDatabase().then((db) =>
                helper.applyFixtures(db, require('./fixtures/decktree-editors.json'))
            )
        );
    });

    // TODO any tests involving restricted / private decks are commented out/skipped until feature is enabled

    describe('#forkAllowed()', function() {

        it('should return true for the deck owner regardless of access level', function() {
            let userId = 46;
            return Promise.all([
                deckDB.forkAllowed('54', userId)
                .then((forkAllowed) => {
                    forkAllowed.should.equal(true);
                }),
                deckDB._adminUpdate('54', { accessLevel: 'private' })
                .then(() => deckDB.forkAllowed('54', userId))
                .then((forkAllowed) => {
                    forkAllowed.should.equal(true);
                }),
                deckDB._adminUpdate('54', { accessLevel: 'restricted' })
                .then(() => deckDB.forkAllowed('54', userId))
                .then((forkAllowed) => {
                    forkAllowed.should.equal(true);
                }),
            ]);
        });

        it('should return true for all public decks regardless of the user', function() {
            let someUserId = 666;
            return deckDB.forkAllowed('54', someUserId)
            .then((forkAllowed) => {
                forkAllowed.should.equal(true);
            });

        });

        context.skip('if the deck is private', function() {
            beforeEach(function() {
                return deckDB._adminUpdate('54', { accessLevel: 'private' });
            });

            it('should return false for some unauthorized user', function() {
                let someUserId = 666;
                return deckDB.forkAllowed('54', someUserId)
                .then((forkAllowed) => {
                    forkAllowed.should.equal(false);
                });

            });

        });

        context.skip('if the deck is restricted', function() {
            beforeEach(function() {
                return deckDB._adminUpdate('54', { accessLevel: 'restricted' });
            });

            it('should return true for some unauthorized user', function() {
                let someUserId = 666;
                return deckDB.forkAllowed('54', someUserId)
                .then((forkAllowed) => {
                    forkAllowed.should.equal(true);
                });

            });

            it('should return true for a user implicitly authorized', function() {
                return deckDB.forkAllowed('54', 3)
                .then((forkAllowed) => {
                    forkAllowed.should.equal(true);
                });

            });

            it('should return true for a user explicitly authorized', function() {
                return deckDB.forkAllowed('54', 4)
                .then((forkAllowed) => {
                    forkAllowed.should.equal(true);
                });

            });

            // TODO properly setup a test for this, needs a mock for the user service
            it.skip('should return true for a user explicitly authorized via groups', function() {
                return deckDB.forkAllowed('54', 6)
                .then((forkAllowed) => {
                    forkAllowed.should.equal(true);
                });

            });

        });

    });

    describe('#getDeckUsersGroups()', function() {

        it('should include all implicitly authorized users for decks that are not private', function() {
            // update first to private and recalculate
            return Promise.all([
                deckDB.getDeckUsersGroups('54')
                .then((editors) => {
                    editors.users.should.include.members([ 9, 46, 10, 3 ]);
                }),
                // deckDB._adminUpdate('54', { accessLevel: 'restricted' })
                // .then((updated) => deckDB.getDeckUsersGroups('54'))
                // .then((editors) => {
                //     editors.users.should.include.members([ 9, 46, 10, 3 ]);
                // }),
            ]);

        });

        it.skip('should only include the owner and no groups for decks that are private', function() {
            // update first to private and recalculate
            return deckDB._adminUpdate('54', { accessLevel: 'private' })
            .then((updated) => deckDB.getDeckUsersGroups('54'))
            .then((editors) => {
                editors.users.should.have.members([ 46 ]);
                editors.groups.should.be.empty;
            });

        });

        it.skip('should exactly include all implicitly or explicitly authorized users and authorized groups for restricted decks', function() {
            // update first to restricted and recalculate
            return deckDB._adminUpdate('54', { accessLevel: 'restricted' })
            .then((updated) => deckDB.getDeckUsersGroups('54'))
            .then((editors) => {
                editors.users.should.have.members([ 9, 46, 10, 3, 4, 5 ]);
                editors.groups.should.have.members([ 2 ]);
            });
        });

        it('should exactly include all implicitly or explicitly authorized users and authorized groups for public decks', function() {
            return deckDB.getDeckUsersGroups('54')
            .then((editors) => {
                editors.users.should.have.members([ 9, 46, 10, 3, 4, 5 ]);
                editors.groups.should.have.members([ 2 ]);
            });
        });

    });

    describe('#editAllowed()', function() {

        it('should return true for the deck owner regardless of access level', function() {
            let userId = 46;
            return Promise.all([
                deckDB.editAllowed('54', userId)
                .then((allowed) => {
                    allowed.should.equal(true);
                }),
            ]);
        });

        context('if the deck is public', function() {

            it('should return false for some unauthorized user', function() {
                let someUserId = 666;
                return deckDB.editAllowed('54', someUserId)
                .then((allowed) => {
                    allowed.should.equal(false);
                });

            });

            it('should return true for a user implicitly authorized', function() {
                return deckDB.editAllowed('54', 3)
                .then((allowed) => {
                    allowed.should.equal(true);
                });

            });

            it('should return true for a user explicitly authorized', function() {
                return deckDB.editAllowed('54', 4)
                .then((allowed) => {
                    allowed.should.equal(true);
                });

            });

            // TODO properly setup a test for this, needs a mock for the user service
            it.skip('should return true for a user explicitly authorized via groups', function() {
                return deckDB.editAllowed('54', 6)
                .then((allowed) => {
                    allowed.should.equal(true);
                });

            });

        });

    });

    describe('#adminAllowed()', function() {

        it('should return true for the deck owner', function() {
            let userId = 46;
            return Promise.all([
                deckDB.adminAllowed('54', userId)
                .then((allowed) => {
                    allowed.should.equal(true);
                }),
            ]);
        });

        it('should return false for some unauthorized user', function() {
            let someUserId = 666;
            return deckDB.adminAllowed('54', someUserId)
            .then((allowed) => {
                allowed.should.equal(false);
            });

        });

        it('should return false for a user implicitly authorized', function() {
            return deckDB.adminAllowed('54', 3)
            .then((allowed) => {
                allowed.should.equal(false);
            });

        });

        it('should return false for a user explicitly authorized', function() {
            return deckDB.adminAllowed('54', 4)
            .then((allowed) => {
                allowed.should.equal(false);
            });

        });

        // TODO properly setup a test for this, needs a mock for the user service
        it.skip('should return false for a user explicitly authorized via groups', function() {
            return deckDB.adminAllowed('54', 6)
            .then((allowed) => {
                allowed.should.equal(false);
            });

        });

    });

    describe('#getSubdeckIds', function() {
        it('should return all the subdecks under a root deck', function() {
            return deckDB.getSubdeckIds('54')
            .then((subdeckIds) => {
                subdeckIds.should.have.members([ 54, 55, 91, 92, 101, 56, 57 ]);
            });

        });

    });

    describe('#getPicturesPerDeck', function() {
        it('should return all images found in deck\'s and its sundecks\' slides', function() {
            return deckDB.getPictures('54')
            .then((pictures) => {
                pictures.should.have.members([
                    'http://fileservice.experimental.slidewiki.org/5/ddc9a830-bba4-11e6-9bdb-395cce787fb5.png',
                    'http://fileservice.experimental.slidewiki.org/5/ddfc02d0-bba4-11e6-9bdb-395cce787fb5.png',
                    'http://fileservice.experimental.slidewiki.org/5/ddfc7800-bba4-11e6-9bdb-395cce787fb5.png',
                    'http://fileservice.experimental.slidewiki.org/5/ddfd1440-bba4-11e6-9bdb-395cce787fb5.png',
                    'http://fileservice.experimental.slidewiki.org/5/ddfdb080-bba4-11e6-9bdb-395cce787fb5.png',
                    'http://fileservice.experimental.slidewiki.org/5/ddfe4cc0-bba4-11e6-9bdb-395cce787fb5.png',
                    'http://fileservice.experimental.slidewiki.org/5/ddff1010-bba4-11e6-9bdb-395cce787fb5.png',
                    'http://fileservice.experimental.slidewiki.org/5/de0f8ad0-bba4-11e6-9bdb-395cce787fb5.png',
                    'http://fileservice.experimental.slidewiki.org/5/de107530-bba4-11e6-9bdb-395cce787fb5.png',
                    'http://fileservice.experimental.slidewiki.org/5/de10ea60-bba4-11e6-9bdb-395cce787fb5.png',
                    'http://fileservice.experimental.slidewiki.org/5/de1186a0-bba4-11e6-9bdb-395cce787fb5.png',
                    'http://fileservice.experimental.slidewiki.org/5/de1249f0-bba4-11e6-9bdb-395cce787fb5.png',
                    'http://fileservice.experimental.slidewiki.org/5/de12e630-bba4-11e6-9bdb-395cce787fb5.png',
                    'https://fileservice.experimental.slidewiki.org/2/896eff50-1b86-11e7-9791-51f71d7b28b5.png',
                    'https://fileservice.experimental.slidewiki.org/2/897010c0-1b86-11e7-9791-51f71d7b28b5.jpeg',
                    'https://fileservice.experimental.slidewiki.org/2/89712230-1b86-11e7-9791-51f71d7b28b5.jpeg'
                ]);
            });

        });
    });

});
