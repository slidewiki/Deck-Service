/* eslint dot-notation: 0, no-unused-vars: 0 */
'use strict';

//Mocking is missing completely TODO add mocked objects

describe('REST API', () => {

    let server;

    beforeEach((done) => {
        //Clean everything up before doing new tests
        Object.keys(require.cache).forEach((key) => delete require.cache[key]);
        require('chai').should();
        let hapi = require('hapi');
        server = new hapi.Server();
        server.connection({
            host: 'localhost',
            port: 3000
        });
        let plugins = [
            require('hapi-auth-jwt2')
        ];
        server.register(plugins, (err) => {
            if (err) {
                console.error(err);
                global.process.exit();
            } else {
                server.auth.strategy('jwt', 'jwt', {
                    key: 'dummy',
                    validateFunc: (decoded, request, callback) => {callback(null, true);},
                    verifyOptions: {
                        ignoreExpiration: true
                    }
                });

                server.start(() => {
                    server.log('info', 'Server started at ' + server.info.uri);
                    require('../routes.js')(server);
                    done();
                });
            }
        });
    });

    let slide = {
        title: 'Dummy',
        content: 'dummy',
        language: 'en',
        license: 'CC0',
        user: '1',
        root_deck: '25-1'
    };
    let options = {
        method: 'POST',
        url: '/slide/new',
        payload: slide,
        headers: {
            'Content-Type': 'application/json'
        }
    };

    context('when creating a slide it', () => {
        it('should reply it', (done) => {
            server.inject(options, (response) => {
                response.should.be.an('object').and.contain.keys('statusCode','payload');
                response.statusCode.should.equal(200);
                response.payload.should.be.a('string');
                let payload = JSON.parse(response.payload);
                payload.should.be.an('object').and.contain.keys('language', 'timestamp', 'user');
                payload.language.should.equal('en');
                payload.user.should.equal(1);
                done();
            });
        });
    });
});
