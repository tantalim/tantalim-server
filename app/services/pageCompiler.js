'use strict';

var logger = require('../logger/default').main,
    _ = require('lodash'),
    errors = require('../errors'),
    pageService = require('./pageService'),
    BluebirdPromise = require('bluebird');

function mapFields(pageDefinition, modelFields) {
    pageDefinition.hasFormView = false;
    pageDefinition.hasTableView = false;
    pageDefinition.hasNavigation = false;

    if (pageDefinition.fields) {
        logger.info('Building %d field(s)', pageDefinition.fields.length);

        _.forEach(pageDefinition.fields, function (pageField) {
            var modelField = _.find(modelFields, function (modelField) {
                if (pageField.name === modelField.name) {
                    return modelField;
                }
            });
            if (!modelField) {
                throw Error('Could not find field in model for ' + pageDefinition.name + '.' + pageField.name);
            }
            pageField = _.defaults(pageField, modelField, {
                fieldName: pageField.name, // Backwards compatibility
                label: pageField.name,
                showInNavigation: false,
                showInFormView: true,
                showInTableView: true,
                searchable: true
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

function mergeModelIntoPage(modelDefinition, pageDefinition) {
    pageDefinition.model = pageDefinition.model || pageDefinition.name;
    pageDefinition.viewMode = pageDefinition.viewMode || 'form';

    mapFields(pageDefinition, modelDefinition.fields);

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

    if (pageDefinition.children) {
        logger.info('Parsing children');
        _.forEach(pageDefinition.children, function (child) {
            child.model = child.model || child.name;
            logger.info('child model = ' + child.model);
            var childModel = _.find(modelDefinition.children, function (childModel) {
                if (childModel.name === child.model) {
                    return childModel;
                }
            });
            mergeModelIntoPage(childModel, child);
        });
    }
}

exports.compile = function (pageDefinition) {
    var ARTIFACT = pageService.ARTIFACT; // Easy alias

    logger.info('Starting page compile', pageDefinition.name);

    return new BluebirdPromise(function (resolve, reject) {
        pageDefinition.model = pageDefinition.model || pageDefinition.name;

        pageService.getDefinition(ARTIFACT.MODEL, pageDefinition.model)
            .then(function (modelDefinition) {
                mergeModelIntoPage(modelDefinition, pageDefinition);
                resolve(pageDefinition);
            })
            .catch(function(err) {
                errors.addTrace(err, {
                    method: 'getDefinition',
                    filename: __filename,
                    params: [artifactType, artifactName]
                });
                reject(err);
            });

        logger.info('built promise for ' + pageDefinition.name);
    });
};

exports.prunePageDefinitionForClient = function (original) {
    var pruned = {
        model: {
            name: original.model.name
        }
    };
    return JSON.stringify(pruned);
};
