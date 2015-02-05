'use strict';

var logger = require('../logger/default').main,
    BluebirdPromise = require('bluebird'),
    fs = BluebirdPromise.promisifyAll(require('fs')),
    mkdirp = require('mkdirp'),
    compiler = require('./modelCompiler');

var ARTIFACT = {
    TABLE: 'table',
    MODEL: 'model',
    PAGE: 'page',
    MENU: 'menu'
};

function getArtifactFromSrc(artifactType, moduleName, artifactName) {
    // TODO Double check variables for injection
    return new BluebirdPromise(function (resolve, reject) {
        var file = 'tantalim_modules/' + moduleName + '/src/' + artifactType + 's/' + artifactName + '.json';
        logger.debug('reading file from ' + file);
        return fs.readFileAsync(file, 'utf8')
            .then(function (data) {
                var jsonData = JSON.parse(data);
                jsonData.name = artifactName;
                jsonData.moduleName = moduleName;
                switch (artifactType) {
                    case ARTIFACT.MODEL:
                        compiler.compile(jsonData)
                            .then(resolve)
                            .catch(reject);
                        break;

                    case ARTIFACT.PAGE:
                        if (!jsonData.modelName) {
                            jsonData.modelName = jsonData.name;
                        }
                        resolve(jsonData);
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
        var dir = 'tantalim_modules/' + moduleName + '/dist/' + artifactType + 's/';
        var file = dir + artifactName + '.json';
        logger.debug('reading file from ' + file);
        return fs.readFileAsync(file, 'utf8')
            .then(function (data) {
                resolve(JSON.parse(data));
            })
            .catch(function () {
                logger.debug('catch getArtifactFromCache');
                return getArtifactFromSrc(artifactType, moduleName, artifactName)
                    .then(function (data) {
                        mkdirp(dir, function (err) {
                            if (err) throw err;
                            fs.writeFile(file, JSON.stringify(data), function (err) {
                                if (err) throw err;
                                console.log('saved file');
                            });
                        });
                        resolve(data);
                    })
                    .catch(reject);
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
    if (artifactName === undefined) {
        throw Error('Failed to get undefined ' + artifactType);
    }
    var useCache = false; // For dev, turn if off
    return new BluebirdPromise(function (resolve, reject) {
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
            .catch(reject);
    });
}

exports.ARTIFACT = ARTIFACT;
exports.getDefinition = getDefinition;
