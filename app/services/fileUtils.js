'use strict';

var Promise = require('bluebird'),
    logger = require('../logger/default').main,
    async = require('async'),
    _ = require('lodash'),
    fs = require('fs');

exports.getPathToRawDirUsingFileSystem = function (pageName) {
    return './raw/' + pageName + '/';
};

exports.getPathToRawDirUsingRequire = function (pageName) {
    return '../../raw/' + pageName + '/';
};

var moduleDir = {
    rootDir: function () {
        // We may want to consider getting the directory from application configuration
        return './tantalim_modules/';
    },
    organization: function (name) {
        return this.rootDir() + name + '/';
    },
    module: function (location) {
        return this.organization(location.organization) + location.module + '/';
    }
};
exports.moduleDir = moduleDir;

function modelLocation(organization, module, name) {
    var self = {};
    self.organization = organization;
    self.module = module;
    self.name = name;
    /**
     * FILE or DB
     * @type {string}
     */
    self.storageType = 'FILE';
    return self;
}

function getModulesByOrg(organizationName, callback) {
    fs.readdir(moduleDir.organization(organizationName), function (err, modules) {
        if (err) {
            return callback(err);
        }

        var moduleCollection = _.map(modules, function (module) {
            return modelLocation(organizationName, module);
        });

        callback(err, moduleCollection);
    });
}

function getExtension(filename) {
    var i = filename.lastIndexOf('.');
    return (i < 0) ? '' : filename.substr(i + 1);
}

function convertLocationObjectToPath(fileObject) {
    return './tantalim_modules/' +
        fileObject.organization + '/' +
        fileObject.module + '/' +
        fileObject.type + '/' +
        fileObject.name;
}

function getListByTypeAndName(subDirectory, fileNameMatch) {

    function getSubDirByModule(location, callback) {
        var path = moduleDir.module(location) + subDirectory + '/';

        fs.readdir(path, function (err, fileNames) {
            if (err) {
                if (err.code === 'ENOENT') {
                    logger.warn('Could not find "' + subDirectory + '" directory for: ', location);
                    callback(null, []);
                    return;
                }
                callback(err);
                return;
            }

            logger.debug('getSubDirByModule for', location);

            var validExtensions = ['js', 'html', 'json'];
            fileNames = _.filter(fileNames, function (fileName) {
                return _.some(validExtensions, function (extension) {
                    return (fileName === fileNameMatch + '.' + extension);
                });
            });
            logger.debug(fileNames);

            var dirCollection = _.map(fileNames, function (fileName) {
                var locationObject = _.defaults({
                    name: fileName,
                    type: subDirectory,
                    extension: getExtension(fileName)
                }, location);
                locationObject.rawFilePath = convertLocationObjectToPath(locationObject);

                return locationObject;
            });

            callback(err, dirCollection);
        });
    }

    return new Promise(function (resolve, reject) {
        fs.readdir(moduleDir.rootDir(), function (err, organizations) {
            if (err) {
                return reject(err);
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
            async.map(organizations, getModulesByOrg, processModulesByOrg);
        });
    });
}

function getJsonFromFile(fileLocation) {
    return new Promise(function (resolve, reject) {
        var file = convertLocationObjectToPath(fileLocation);
        logger.debug('getJsonFromFile ' + file);
        fs.readFile(file, 'utf8', function (err, data) {
            if (err) {
                reject(err);
            }
            // TODO figure out how to get this not to crash when getting bad JSON
            logger.debug('parsing...');
            logger.debug(data);
            var json = JSON.parse(data);
            resolve(json);
        });
    });
}

exports.getListByTypeAndName = getListByTypeAndName;
exports.getJsonFromFile = getJsonFromFile;
exports.convertLocationObjectToPath = convertLocationObjectToPath;
