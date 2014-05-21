'use strict';

var config = require('../config'),
    configAppRoot = '../' + config.appRoot + 'app/',
    sinon = require('sinon'),
    proxyquire = require('proxyquire'),
    Promise = require('bluebird'),
    fileUtils = {},
    chai = require('chai');

chai.Should();
chai.use(require('chai-as-promised'));

xdescribe('Page service', function () {
    describe('getPageByName', function () {
        var service, res,
            req = {
                pageName: 'TestPage'
            };

        beforeEach(function () {
            service = proxyquire(configAppRoot + 'services/pageService', {
                './fileUtils': fileUtils
            });

        });

        it('should not find the file', function (done) {
            fileUtils.getListByType = Promise.method(function () {
                return [];
            });

            service.getPageByName('FileDoesNotExist').should.eventually.eql({
                error: 'PAGE_NOT_FOUND',
                content: {
                    staticContent: 'Page does not exist for FileDoesNotExist'
                }
            }).notify(done);
        });

        it('should find the raw file', function (done) {
            fileUtils.getListByType = Promise.method(function () {
                return [
                    {
                        name: 'RawFile',
                        storageType: 'FILE',
                        path: 'foo/bar/RawFile.js'
                    }
                ];
            });

            service.getPageByName('RawFile').should.eventually.eql({
                rawFilePath: 'foo/bar/RawFile.js'
            }).notify(done);
        });

        it('should find the page file', function (done) {
            fileUtils.getListByType = Promise.method(function () {
                return [
                    {
                        name: 'PageFile',
                        storageType: 'FILE',
                        path: 'foo/bar/PageFile.json'
                    }
                ];
            });

            service.getPageByName('PageFile').should.eventually.eql({
                page: '../PageFile.json'
            }).notify(done);
        });

        it('should find the page in DB', function (done) {
//            pageDao.getPageSql = function (name) {
//                return {
//                    toSql: function () {
//                        return 'SELECT * FROM pages';
//                    }
//                }
//            };
//
            service.getPageByName('TestDatabasePage').should.eventually.eql({
                content: {
                    page: {},
                    model: {}
                }
            }).notify(done);
//            done();
        });
    });
});
