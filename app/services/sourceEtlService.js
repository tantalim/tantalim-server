'use strict';

var _ = require('lodash'),
    logger = require('../logger/default').main,
    BluebirdPromise = require('bluebird'),
    modelSaver = require('./modelSaver'),
    dataReader = require('./dataReader'),
    artifactService = require('./pageService');

function getArtifactWriterAndSource(artifactType, artifactName) {
    // TODO use async here to get them at the same time
    logger.info('starting getArtifactWriterAndSource');
    return new BluebirdPromise(function (resolve, reject) {
        artifactService.getDefinition(artifactService.ARTIFACT.MODEL, '~' + artifactType)
            .then(function (artifactWriter) {
                //console.info(artifactWriter);
                return artifactService.getRawArtifactFromSrc(artifactType, 'local', artifactName)
                    .then(function (artifactSource) {
                        if (!artifactSource) {
                            return reject('artifactSource %s not found named %s', artifactType, artifactName);
                        }
                        logger.info(artifactSource);
                        logger.info('resolving getArtifactWriterAndSource');
                        resolve([artifactWriter, artifactSource]);
                    })
                    .catch(reject);
            })
            .catch(reject);

    });
}

function removePreviousDatabaseInstance(artifactWriter, artifactName) {
    logger.info('starting removePreviousDatabaseInstance');
    return new BluebirdPromise(function (resolve, reject) {
        dataReader.getData(artifactWriter, 'name = ' + artifactName)
            .then(function (rows) {
                if (rows.length === 0) {
                    logger.debug('No records found for %s, continuing', artifactName);
                    return resolve();
                }
                if (rows.length > 1) {
                    return reject('Found more than 1 instance of ' + artifactName);
                }

                return modelSaver.deleteData(artifactWriter, rows[0])
                    .then(resolve)
                    .catch(reject);
            });

    });
}

function convertSourceToData(artifactModel, artifactSource) {
    var data = {
        state: modelSaver.STATES.INSERTED,
        data: artifactSource
    };
    if (artifactModel.children && artifactModel.children.length > 0) {
        data.children = {};
        _.forEach(artifactModel.children, function(childModel) {
            data.children[childModel.name] = _.map(artifactSource[childModel.name], function(childSource) {
                return convertSourceToData(childModel, childSource);
            });
        });
    }
    return data;
}

exports.importArtifact = function () {
    return new BluebirdPromise(function (resolve, reject) {
        return getArtifactWriterAndSource(artifactService.ARTIFACT.TABLE, 'Column')
            .then(function (results) {
                var artifactWriter = results[0],
                    artifactSource = results[1];

                logger.log('artifactWriter=', artifactWriter);
                logger.log('artifactSource=', artifactSource);
                var dataToInsert = convertSourceToData(artifactWriter, artifactSource);
                logger.log('dataToInsert=', dataToInsert);
                return removePreviousDatabaseInstance(artifactWriter, artifactSource.name)
                    .then(function () {
                        return modelSaver.insertData(artifactWriter, dataToInsert)
                            .then(resolve)
                            .catch(reject);
                    })
                    .catch(reject);
            })
            .catch(reject);
    });
};
