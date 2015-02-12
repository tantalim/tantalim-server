'use strict';

var logger = require('../logger/default').main,
    BluebirdPromise = require('bluebird'),
    fs = BluebirdPromise.promisifyAll(require('fs')),
    mkdirp = require('mkdirp'),
    errors = require('../errors'),
    pageCompiler = require('./pageCompiler'),
    modelCompiler = require('./modelCompiler'),
    menuCompiler = require('./menuCompiler');

var ARTIFACT = {
    TABLE: 'table',
    MODEL: 'model',
    PAGE: 'page',
    MENU: 'menu'
};

function getArtifactDirectory(moduleName) {
    if (moduleName && moduleName !== 'local') {
        return 'tantalim_modules/' + moduleName + '/';
    }
    return '';
}

function getArtifactFromSrc(artifactType, moduleName, artifactName) {

    var trace = {
        method: 'getArtifactFromSrc',
        filename: __filename,
        params: [artifactType, moduleName, artifactName]
    };

    // TODO Double check variables for injection
    return new BluebirdPromise(function (resolve, bbReject) {
        var reject = function(err) {
            errors.addTrace(err, trace);
            bbReject(err);
        };
        var file = getArtifactDirectory() + 'src/' + artifactType + 's/' + artifactName + '.json';

        logger.debug('reading file from ' + file);
        return fs.readFileAsync(file, 'utf8')
            .then(function (data) {
                var jsonData = JSON.parse(data);
                jsonData.name = artifactName;
                jsonData.moduleName = moduleName;
                logger.debug('resolving %s data for %s', artifactType, artifactName);
                switch (artifactType) {
                    case ARTIFACT.MODEL:
                        modelCompiler.compile(jsonData)
                            .then(resolve)
                            .catch(reject);
                        break;
                    case ARTIFACT.MENU:
                        menuCompiler.compile(jsonData)
                            .then(resolve)
                            .catch(reject);
                        break;
                    case ARTIFACT.PAGE:
                        pageCompiler.compile(jsonData)
                            .then(resolve)
                            .catch(reject);
                        break;

                    default:
                        resolve(jsonData);
                }
            })
            .catch(reject);
    });
}

function getArtifactFromCache(artifactType, moduleName, artifactName) {
    // TODO Double check variables for injection
    return new BluebirdPromise(function (resolve, reject) {
        var file = getArtifactDirectory() + 'dist/' + artifactType + 's/' + artifactName + '.json';
        logger.debug('reading file from ' + file);
        return fs.readFileAsync(file, 'utf8')
            .then(function (data) {
                resolve(JSON.parse(data));
            })
            .catch(function () {
                logger.debug('catch getArtifactFromCache');
                return getArtifactFromSrc(artifactType, moduleName, artifactName)
                    .then(function (data) {
                        mkdirp(getArtifactDirectory(), function (err) {
                            if (err) throw err;
                            fs.writeFile(file, JSON.stringify(data), function (err) {
                                if (err) throw err;
                                console.log('saved file');
                            });
                        });
                        resolve(data);
                    })
                    .catch(function(err) {
                        console.log('error', err);
                        errors.addTrace(err, {
                            method: 'getArtifactFromCache',
                            filename: __filename
                        });
                        reject(err);
                    });
            });
    });
}

function getModuleName() {
    return new BluebirdPromise(function (resolve) {
        // This is the only one we support right now
        resolve('tantalim-ide');
    });
}

function getDefinition(artifactType, artifactName) {
    //console.log('getDefinition %s %s', artifactType, artifactName);
    if (artifactName === undefined) {
        throw Error('Failed to get undefined ' + artifactType);
    }
    var useCache = false; // For dev, turn if off
    return new BluebirdPromise(function (resolve, reject) {
        logger.debug('------------------------------------');
        logger.debug('getDefinition for ' + artifactType + ':' + artifactName);
        getModuleName(artifactType, artifactName)
            .then(function (moduleName) {
                logger.debug('getDefinition for ' + moduleName + '/' + artifactName);
                switch (artifactType) {
                    case ARTIFACT.MODEL:
                        if (useCache) {
                            // Models get compiled and cached, so check there first
                            return getArtifactFromCache(artifactType, moduleName, artifactName);
                        } else {
                            return getArtifactFromSrc(artifactType, moduleName, artifactName);
                        }
                        break;
                    default :
                        // All other artifact types don't get compiled, so go directly to src
                        return getArtifactFromSrc(artifactType, moduleName, artifactName);
                }
            })
            .then(resolve)
            .catch(function(err) {
                errors.addTrace(err, {
                    method: 'getDefinition',
                    filename: __filename,
                    params: [artifactType, artifactName]
                });
                reject(err);
            });
    });
}

exports.ARTIFACT = ARTIFACT;
exports.getDefinition = getDefinition;
