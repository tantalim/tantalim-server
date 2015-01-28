'use strict';

var BluebirdPromise = require('bluebird'),
    logger = require('../logger/default').main,
    async = require('async'),
    _ = require('lodash'),
    fs = require('fs');

function getExtension(filename) {
    var i = filename.lastIndexOf('.');
    return (i < 0) ? '' : filename.substr(i + 1);
}

function getListByTypeAndName(rootDir, subDirectory, fileNameMatch) {
    logger.info('starting getListByTypeAndName for %s %s %s', rootDir, subDirectory, fileNameMatch);

    return new BluebirdPromise(function (resolve, reject) {
        var readListOfOrganizations = function (rootDir, organizations) {
            function getSubDirByModule(module, callback) {
                var path = module.rawFilePath + '/' + subDirectory;

                fs.readdir(path, function (err, fileNames) {
                    if (err) {
                        if (err.code === 'ENOENT') {
                            logger.warn('Could not find "' + subDirectory + '" directory for: ', module.module);
                            callback(null, []);
                            return;
                        }
                        callback(err);
                        return;
                    }

                    logger.debug('getSubDirByModule for', module.module);

                    var validExtensions = ['js', 'html', 'json'];
                    fileNames = _.filter(fileNames, function (fileName) {
                        return _.some(validExtensions, function (extension) {
                            return (fileName === fileNameMatch + '.' + extension);
                        });
                    });
                    logger.debug(fileNames);

                    var dirCollection = _.map(fileNames, function (fileName) {
                        return _.defaults({
                            name: fileName,
                            type: subDirectory,
                            extension: getExtension(fileName),
                            rawFilePath: path + '/' + fileName
                        }, module);
                    });

                    callback(err, dirCollection);
                });
            }

            function getModules(organization, callback) {
                fs.readdir(organization.rawFilePath, function (err, directoryList) {
                    if (err) {
                        return callback(err);
                    }

                    var moduleCollection = _.map(directoryList, function (moduleName) {
                        var module = _.defaults({
                            module: moduleName,
                            rawFilePath: organization.rawFilePath + '/' + moduleName
                        }, organization);
                        return module;
                    });

                    callback(err, moduleCollection);
                });
            }

            function processModelsByModule(err, modelsArray) {
                if (err) {
                    return reject(err);
                }

                var models = _.flatten(modelsArray);
                logger.debug('DONE processModelsByModule', models);
                resolve(models);
            }

            function processModulesByOrg(err, modulesArray) {
                if (err) {
                    return reject(err);
                }

                var modules = _.flatten(modulesArray);
                logger.debug('processModulesByOrg', modules);

                async.map(modules, getSubDirByModule, processModelsByModule);
            }

            logger.debug('found organizations', organizations);

            var organizationList = _.map(organizations, function (organizationName) {
                return {
                    organization: organizationName,
                    /**
                     * FILE or DB
                     * @type {string}
                     */
                    storageType: 'FILE',
                    rawFilePath: rootDir + '/' + organizationName
                };
            });

            async.map(organizationList, getModules, processModulesByOrg);
        };

        fs.readdir(rootDir, function (err, directoryList) {
            if (err) {
                return reject(err);
            }
            readListOfOrganizations(rootDir, directoryList);
        });
    });
}

function getJsonFromFile(fileLocation) {
    return new BluebirdPromise(function (resolve, reject) {
        var file = fileLocation.rawFilePath;

        logger.debug('getJsonFromFile ' + file);
        fs.readFile(file, 'utf8', function (err, data) {
            if (err) {
                return reject(err);
            }
            // TODO figure out how to get this not to crash when getting bad JSON
            try {
                logger.debug('parsing...');
                logger.debug(data);
                var json = JSON.parse(data);
                resolve(json);
            } catch (e) {
                resolve('failed');
            }
        });
    });
}

exports.getListByTypeAndName = getListByTypeAndName;
exports.getJsonFromFile = getJsonFromFile;
