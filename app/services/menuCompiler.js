'use strict';

var logger = require('../logger/default').main,
    _ = require('lodash'),
    pageService = require('./pageService'),
    async = require('async'),
    BluebirdPromise = require('bluebird');

function compile(menuDefinition) {
    logger.info('Starting compile', menuDefinition.name);

    var pageNames = [];

    function setPageNames(items) {
        logger.debug('Starting setPageNames', items);
        _.forEach(items, function (item) {
            if ('page' in item) {
                logger.debug('Found page', item);
                pageNames.push(item.page);
            }
            if (item.items) {
                setPageNames(item.items);
            }
        });
    }

    setPageNames(menuDefinition.content);
    logger.debug('setPageNames DONE %s', JSON.stringify(pageNames));

    function fillPages(items, pages) {
        logger.debug('Starting fillPages for %d item(s)', items.length);
        _.forEach(items, function (item) {
            if ('page' in item) {
                item.title = pages[item.page].title;
            }
            if (item.items) {
                fillPages(item.items, pages);
            }
        });
    }

    return new BluebirdPromise(function (resolve) {
        var pages = {};
        async.each(pageNames, function (pageName, resolveEach) {
            pageService.getDefinition(pageService.ARTIFACT.PAGE, pageName)
                .then(function (pageDefinition) {
                    logger.debug('Found ', pageName);
                    pages[pageName] = pageDefinition;
                    return resolveEach();
                })
                .catch(function (err) {
                    pages[pageName] = {title: pageName + ' MISSING'};
                    return resolveEach();
                });
        }, function () {
            try {
                fillPages(menuDefinition.content, pages);
            } catch (err) {
                logger.error(JSON.stringify(err));
            }
            return resolve(menuDefinition);
        });
    });
}

exports.compile = compile;
