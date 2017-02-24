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

    // TODO forkAllowed functionality will not be used for now, so let's skip testing it for now
    describe.skip('#forkAllowed()', function() {

        it('should return true for the deck revision owner regardless of access level', function() {
            let userId = 46;
            return Promise.all([
                deckDB.forkAllowed('54-12', userId)
                .then((forkAllowed) => {
                    forkAllowed.should.equal(true);
                }),
                deckDB.update('54-12', { accessLevel: 'private' })
                .then(() => deckDB.forkAllowed('54-12', userId))
                .then((forkAllowed) => {
                    forkAllowed.should.equal(true);
                }),
                deckDB.update('54-12', { accessLevel: 'restricted' })
                .then(() => deckDB.forkAllowed('54-12', userId))
                .then((forkAllowed) => {
                    forkAllowed.should.equal(true);
                }),
            ]);
        });

        it('should return true for all public deck revisions regardless of the user', function() {
            let someUserId = 666;
            return deckDB.forkAllowed('54-12', someUserId)
            .then((forkAllowed) => {
                forkAllowed.should.equal(true);
            });

        });

        context('if the deck revision is restricted', function() {

            it('should return false for some unauthorized user', function() {
                let someUserId = 666;
                return deckDB.update('54-12', { accessLevel: 'restricted' })
                .then(() => deckDB.forkAllowed('54-12', someUserId))
                .then((forkAllowed) => {
                    forkAllowed.should.equal(false);
                });

            });

            it('should return true for a user implicitly authorized', function() {
                return deckDB.update('54-12', { accessLevel: 'restricted' })
                .then(() => deckDB.forkAllowed('54-12', 3))
                .then((forkAllowed) => {
                    forkAllowed.should.equal(true);
                });

            });

            it('should return true for a user explicitly authorized', function() {
                return deckDB.update('54-12', { accessLevel: 'restricted' })
                .then(() => deckDB.forkAllowed('54-12', 4))
                .then((forkAllowed) => {
                    forkAllowed.should.equal(true);
                });

            });

            // TODO properly setup a test for this, needs a mock for the user service
            it.skip('should return true for a user explicitly authorized via groups', function() {
                return deckDB.update('54-12', { accessLevel: 'restricted' })
                .then(() => deckDB.forkAllowed('54-12', 6))
                .then((forkAllowed) => {
                    forkAllowed.should.equal(true);
                });

            });

        });

    });

    // TODO any tests involving restricted / private decks are commented out/skipped until feature is enabled

    describe('#needsNewRevision()', function() {

        it('should allow save without new revision for owner regardless of access level', function() {
            return Promise.all([
                deckDB.needsNewRevision('54-12', 46)
                .then((needs) => {
                    needs.should.have.property('needs_revision', false);
                }),
                // deckDB.update('54-12', { accessLevel: 'private' })
                // .then(() => deckDB.needsNewRevision('54-12', 46))
                // .then((needs) => {
                //     needs.should.have.property('needs_revision', false);
                // }),
                // deckDB.update('54-12', { accessLevel: 'restricted' })
                // .then(() => deckDB.needsNewRevision('54-12', 46))
                // .then((needs) => {
                //     needs.should.have.property('needs_revision', false);
                // }),
            ]);

        });

        context('if the deck revision is public', function() {

            it('should allow save without new revision for a user implicitly authorized', function() {
                return deckDB.needsNewRevision('54-12', 3)
                .then((needs) => {
                    needs.should.have.property('needs_revision', false);
                });

            });

            it('should allow save without new revision for a user explicitly authorized', function() {
                return deckDB.needsNewRevision('54-12', 4)
                .then((needs) => {
                    needs.should.have.property('needs_revision', false);
                });

            });

            // TODO properly setup a test for this, needs a mock for the user service
            it.skip('should allow save without new revision for a user explicitly authorized via groups', function() {
                return deckDB.needsNewRevision('54-12', 6)
                .then((needs) => {
                    needs.should.have.property('needs_revision', false);
                });

            });

        });

        context.skip('if the deck revision is restricted', function() {
            beforeEach(function() {
                return deckDB.update('54-12', { accessLevel: 'restricted' });
            });

            it('should allow save without new revision for a user implicitly authorized', function() {
                return deckDB.needsNewRevision('54-12', 3)
                .then((needs) => {
                    needs.should.have.property('needs_revision', false);
                });

            });

            it('should allow save without new revision for a user explicitly authorized', function() {
                return deckDB.needsNewRevision('54-12', 4)
                .then((needs) => {
                    needs.should.have.property('needs_revision', false);
                });

            });

            // TODO properly setup a test for this, needs a mock for the user service
            it.skip('should allow save without new revision for a user explicitly authorized via groups', function() {
                return deckDB.needsNewRevision('54-12', 6)
                .then((needs) => {
                    needs.should.have.property('needs_revision', false);
                });

            });

        });

    });

    describe('#getDeckUsersGroups()', function() {

        it('should include all implicitly authorized users for deck revisions that are not private', function() {
            // update first to private and recalculate
            return Promise.all([
                deckDB.getDeckUsersGroups('54-12')
                .then((editors) => {
                    editors.users.should.include.members([ 9, 46, 26, 10, 3 ]);
                }),
                // deckDB.update('54-12', { accessLevel: 'restricted' })
                // .then((updated) => deckDB.getDeckUsersGroups('54-12'))
                // .then((editors) => {
                //     editors.users.should.include.members([ 9, 46, 26, 10, 3 ]);
                // }),
            ]);

        });

        it.skip('should only include the owner and no groups for deck revisions that are private', function() {
            // update first to private and recalculate
            return deckDB.update('54-12', { accessLevel: 'private' })
            .then((updated) => deckDB.getDeckUsersGroups('54-12'))
            .then((editors) => {
                editors.users.should.have.members([ 46 ]);
                editors.groups.should.be.empty;
            });

        });

        it.skip('should exactly include all implicitly or explicitly authorized users and authorized groups for restricted deck revisions', function() {
            // update first to restricted and recalculate
            return deckDB.update('54-12', { accessLevel: 'restricted' })
            .then((updated) => deckDB.getDeckUsersGroups('54-12'))
            .then((editors) => {
                editors.users.should.have.members([ 9, 46, 26, 10, 3, 4, 5 ]);
                editors.groups.should.have.members([ 2 ]);
            });
        });

        it('should exactly include all implicitly or explicitly authorized users and authorized groups for public deck revisions', function() {
            return deckDB.getDeckUsersGroups('54-12')
            .then((editors) => {
                editors.users.should.have.members([ 9, 46, 26, 10, 3, 4, 5 ]);
                editors.groups.should.have.members([ 2 ]);
            });
        });

    });

});
