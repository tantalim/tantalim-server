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
        pageDefinition.hasFormView = false;
        pageDefinition.hasTableView = false;
        pageDefinition.hasNavigation = false;

        if (pageDefinition.fields) {
            logger.info('Building %d field(s)', pageDefinition.fields.length);

            var modelFields = models[pageDefinition.model].fields;
            _.forEach(pageDefinition.fields, function (pageField) {
                var modelField = _.find(modelFields, function (modelField) {
                    if (pageField.name === modelField.name) {
                        return modelField;
                    }
                });
                if (!modelField) {
                    throw Error('Could not find basis column for ' + pageDefinition.name + '.' + pageField.name);
                }
                pageField = _.defaults(pageField, modelField, {
                    fieldName: pageField.name, // Backwards compatibility
                    label: pageField.name,
                    showInNavigation: false,
                    showInFormView: true,
                    showInTableView: true
                });
                if (pageField.showInNavigation) {
                    pageDefinition.hasNavigation = true;
                }
                if (pageField.showInFormView) {
                    pageDefinition.hasFormView = true;
                }
                if (pageField.showInTableView) {
                    pageDefinition.hasTableView = true;
                }
            });
        } else {
            logger.warn('Page `%s` had no fields', pageDefinition.name);
        }
        pageDefinition.hasBothViews = pageDefinition.hasFormView && pageDefinition.hasTableView;
    }

    function parseAndCompile(pageDefinition) {
        logger.info('Running parseAndCompile');
        var todo = [];

        pageDefinition.model = pageDefinition.model || pageDefinition.name;
        pageDefinition.viewMode = pageDefinition.viewMode || 'form';

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

        if (pageDefinition.viewMode === 'multiple') {
            logger.warn('`multiple` is not a valid viewMode anymore. Use `table`');
            pageDefinition.viewMode = 'table';
        }
        if (pageDefinition.viewMode === 'single') {
            logger.warn('`single` is not a valid viewMode. Use `form`');
            pageDefinition.viewMode = 'form';
        }
        if (pageDefinition.viewMode === 'table' && !pageDefinition.hasTableView) {
            logger.warn('viewMode is defined as table but has no visible table fields');
            pageDefinition.viewMode = 'form';
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
