'use strict';

var config = require('../config'),
    configAppRoot = '../' + config.appRoot + 'app/',
    proxyquire = require('proxyquire'),
    BluebirdPromise = require('bluebird'),
    fileUtils = {},
    chai = require('chai');

chai.Should();
chai.use(require('chai-as-promised'));

describe('Page service', function () {
    describe('getPageByName', function () {
        var service;

//        ,
//        req = {
//            pageName: 'TestPage'
//        }

        beforeEach(function () {
            service = proxyquire(configAppRoot + 'services/pageService', {
                './fileUtils': fileUtils
            });

        });

        it('should not find the file', function (done) {
            fileUtils.getListByTypeAndName = BluebirdPromise.method(function () {
                return [];
            });

            service.getLocationByName('FileDoesNotExist').should.eventually.eql({
                error: 'PAGE_NOT_FOUND',
                content: {
                    staticContent: 'Page does not exist for FileDoesNotExist'
                }
            }).notify( function(){ done(); });
            // function(){ done(); }
            // See https://github.com/visionmedia/mocha/issues/1187
        });

        it('should find the page file', function (done) {
            fileUtils.getListByTypeAndName = BluebirdPromise.method(function () {
                return [
                    {
                        name: 'PageFile',
                        storageType: 'FILE',
                        path: 'foo/bar/PageFile.json'
                    }
                ];
            });

            service.getLocationByName('PageFile').should.eventually.eql({
                name: 'PageFile',
                storageType: 'FILE',
                path: 'foo/bar/PageFile.json'
            }).notify(done);
        });

        it.skip('should find the page in DB', function (done) {
//            pageDao.getPageSql = function (name) {
//                return {
//                    toSql: function () {
//                        return 'SELECT * FROM pages';
//                    }
//                }
//            };

            service.getLocationByName('TestDatabasePage').should.eventually.eql({
                content: {
                    page: {},
                    model: {}
                }
            }).notify( function(){ done(); });
//            done();
        });
    });
});
