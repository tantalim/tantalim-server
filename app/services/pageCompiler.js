'use strict';

var logger = require('../logger/default').debug,
    _ = require('lodash'),
    pageService = require('./pageService'),
    BluebirdPromise = require('bluebird');

var models = {};

function compile(pageDefinition) {
    var ARTIFACT = pageService.ARTIFACT; // Easy alias

    logger.info('Starting compile', pageDefinition.name);

    function mapFields(pageDefinition) {
        if (!pageDefinition.fields) {
            logger.warn('Page `%s` had no fields', pageDefinition.name);
            return;
        }

        logger.info('Building %d field(s)', pageDefinition.fields.length);

        var modelFields = models[pageDefinition.model].fields;
        _.forEach(pageDefinition.fields, function (pageField) {
            var modelField = _.find(modelFields, function (modelField) {
                if (pageField.name === modelField.name) {
                    return modelField;
                }
            });
            pageField = _.defaults(pageField, modelField);
        });
    }

    function parseAndCompile(pageDefinition) {
        logger.info('Running parseAndCompile');
        var todo = [];

        pageDefinition.model = pageDefinition.model || pageDefinition.name;

        if (!models[pageDefinition.model]) {
            todo.push(pageService.getDefinition(ARTIFACT.MODEL, pageDefinition.model)
                .then(function (modelDefinition) {
                    models[modelDefinition.name] = modelDefinition;
                }));
        }

        if (pageDefinition.children) {
            logger.info('Parsing children');
            _.forEach(pageDefinition.children, function (child) {
                parseAndCompile(child);
            });
        }

        if (todo.length === 0) {
            mapFields(pageDefinition);
        }

        return todo;
    }
    
    return new BluebirdPromise(function (resolve, reject) {
        var todo = parseAndCompile(pageDefinition);
        if (todo.length > 0) {
            logger.info('BluebirdPromise');
            BluebirdPromise.all(todo)
                .then(function () {
                    return compile(pageDefinition)
                        .then(resolve);
                })
                .catch(reject);
        } else {
            logger.info('Done');
            return resolve(pageDefinition);
        }
        logger.info('build promise');
    });
}

exports.compile = compile;
