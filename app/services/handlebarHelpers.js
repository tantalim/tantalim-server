'use strict';

exports.ngVar = function (angularVariable) {
    return '{{' + angularVariable + '}}';
};

exports.bootstrapClassesForToc = function (depth) {
    if (!depth) {
        depth = 0;
    }
    var offset = depth;
    var width = 12 - offset;
    if (offset > 0) {
        return 'col-xs-' + width + ' col-xs-offset-' + offset;
    } else {
        return 'col-xs-' + width;
    }
};

exports.json = function (value) {
    return JSON.stringify(value);
};

exports.fieldType = function (fieldType, value, context) {
    var TEXT = 'text';
    if (!fieldType) {
        if (!value || value === TEXT) {
            return context.fn(this);
        }
    }
    if (fieldType === value) {
        return context.fn(this);
    }
    return '';
};
