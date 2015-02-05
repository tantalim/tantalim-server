'use strict';

var config = require('../config'),
    configAppRoot = '../' + config.appRoot + 'app/',
    proxyquire = require('proxyquire'),
    //BluebirdPromise = require('bluebird'),
    fs = {},
    chai = require('chai');

chai.Should();
chai.use(require('chai-as-promised'));

describe('Page service', function () {
    describe('getPageByName', function () {
        var pageService;

        beforeEach(function () {
            pageService = proxyquire(configAppRoot + 'services/pageService', {
                'fs': fs
            });
        });

        it('should not find the file', function (done) {
            fs.readFileAsync = function () {
                console.info('readFileAsync');
            };

            pageService.getDefinition(pageService.ARTIFACT.PAGE, 'FileDoesNotExist').should.eventually.eql({
                error: 'PAGE_NOT_FOUND',
                content: {
                    staticContent: 'Page does not exist for FileDoesNotExist'
                }
            }).notify(function () {
                done();
            });
            // function(){ done(); }
            // See https://github.com/visionmedia/mocha/issues/1187
        });
    });
});
