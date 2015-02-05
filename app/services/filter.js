'use strict';

var logger = require('../logger/default').main,
    _ = require('lodash'),
    knex = require('knex').knex;

var patternEquals = /(.+) (=|IN|Contains|BeginsWith|EndsWith|>|<|Before|After) (.+)/i;
var patternAndOr = /(.+) (AND|OR) (.+)/i;
var patternDateInterval = /(-?)(\d+)(\w+)/;

function toIntervalType(intervalChar) {
    switch (intervalChar.toUpperCase()) {
        case 'D':
        case 'DAY':
        case 'DAYS':
            return 'DAY';
        case 'W':
        case 'WEEK':
            return 'WEEK';
        case 'M':
        case 'MONTH':
        case 'MONTHS':
            return 'MONTH';
        case 'Y':
        case 'YR':
        case 'YEAR':
        case 'YEARS':
            return 'YEAR';
        default:
            throw Error('Invalid interval type: ' + intervalChar);
    }
}

function formatDate(dateString) {
    dateString = dateString.trim();
    if (dateString === 'NOW') {
        return 'NOW()';
    }

    var match = dateString.match(patternDateInterval);
    if (!match) {
        throw Error('Invalid format for date interval: ' + dateString);
    }

    var fxn = match[1] === '-' ? 'DATE_SUB' : 'DATE_ADD';
    return fxn + '(NOW(), INTERVAL ' + match[2] + ' ' + toIntervalType(match[3]) + ')';
}

function toSql(fieldName, fields) {
    var field = _.find(fields, function(field) {
        if (field.name === fieldName) {
            return field;
        }
    });
    logger.debug('Found field ' + fieldName, JSON.stringify(field));

    if (field) {
        return 't' + field.stepCount + '.' + field.basisColumn.dbName;
    }
    throw Error('Could not find field named ' + fieldName);
}

function apply(filterString, sql, fields) {
    if (!filterString) {
        return;
    }

    logger.debug('applying filterString');
    var andMatch = filterString.match(patternAndOr);
    if (andMatch) {
        logger.debug('andMatch: ', andMatch);
        apply(andMatch[1], sql, fields);
        apply(andMatch[3], sql, fields);
        return;
    }

    filterString = filterString.trim();

    var equalsMatch = filterString.match(patternEquals);
    if (equalsMatch) {
        logger.debug('equalsMatch: ' + equalsMatch);
        var fieldSql = toSql(equalsMatch[1], fields);
        switch (equalsMatch[2].toUpperCase()) {
            case 'BEGINSWITH':
                sql.where(fieldSql, 'like', equalsMatch[3] + '%');
                break;
            case 'CONTAINS':
                sql.where(fieldSql, 'like', '%' + equalsMatch[3] + '%');
                break;
            case 'ENDSWITH':
                sql.where(fieldSql, 'like', '%' + equalsMatch[3]);
                break;
            case 'BEFORE':
                sql.where(fieldSql, '<', knex.raw(formatDate(equalsMatch[3])));
                break;
            case 'AFTER':
                sql.where(fieldSql, '>', knex.raw(formatDate(equalsMatch[3])));
                break;
            case 'IN':
                var list = equalsMatch[3].split(',');
                sql.whereIn(fieldSql, list);
                break;
            default:
                sql.where(fieldSql, equalsMatch[2], equalsMatch[3]);
        }
    } else {
        logger.error('failed to parse filter: ' + filterString);
    }
}

exports.apply = apply;
