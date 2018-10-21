'use strict';
var _ = require('lodash');
var ApimapFieldTypeDetector = require('./apimap-field-type-detector');

function ApimapFieldBuilder(model, column, options) {
  var DataTypes = options.sequelize;

  function isRequired() {
    return column._autoGenerated !== true && column.allowNull === false;
  }

  function getValidations(automaticValue) {
    var validations = [];

    // NOTICE: Do not inspect validation for autogenerated fields, it would
    //         block the record creation/update.
    if (automaticValue || column._autoGenerated === true) {
      return validations;
    }

    if (column.allowNull === false) {
      validations.push({
        type: 'is present'
      });
    }

    if (!column.validate) { return validations; }

    if (column.validate.min) {
      validations.push({
        type: 'is greater than',
        value: column.validate.min.args || column.validate.min,
        message: column.validate.min.msg
      });
    }

    if (column.validate.max) {
      validations.push({
        type: 'is less than',
        value: column.validate.max.args || column.validate.max,
        message: column.validate.max.msg
      });
    }

    if (column.validate.isBefore) {
      validations.push({
        type: 'is before',
        value: column.validate.isBefore.args || column.validate.isBefore,
        message: column.validate.isBefore.msg
      });
    }

    if (column.validate.isAfter) {
      validations.push({
        type: 'is after',
        value: column.validate.isAfter.args || column.validate.isAfter,
        message: column.validate.isAfter.msg
      });
    }

    if (column.validate.len) {
      var length = column.validate.len.args || column.validate.len;

      if (_.isArray(length) && length[0]) {
        validations.push({
          type: 'is longer than',
          value: length[0],
          message: column.validate.len.msg
        });

        if (length[1]) {
          validations.push({
            type: 'is shorter than',
            value: length[1],
            message: column.validate.len.msg
          });
        }
      } else {
        validations.push({
          type: 'is longer than',
          value: length,
          message: column.validate.len.msg
        });
      }
    }

    if (column.validate.contains) {
      validations.push({
        type: 'contains',
        value: column.validate.contains.args || column.validate.contains,
        message: column.validate.contains.msg
      });
    }

    if (column.validate.is && !_.isArray(column.validate.is)) {
      var value = column.validate.is.args || column.validate.is;

      validations.push({
        type: 'is like',
        value: value.toString(),
        message: column.validate.is.msg
      });
    }

    return validations;
  }

  this.perform = function () {
    var schema = {
      field: column.fieldName,
      type: new ApimapFieldTypeDetector(column, options).perform(),
      // NOTICE: Necessary only for fields with different field and database
      //         column names
      columnName: column.field
    };

    if (column.primaryKey === true) {
      schema.primaryKey = true;
    }
    if (schema.type === 'Enum') {
      schema.enums = column.values;
    }

    if (isRequired()) {
      schema.isRequired = true;
    }

    var canHaveDynamicDefaultValue = ['Date', 'Dateonly'].indexOf(schema.type) !== -1 ||
      column.type instanceof DataTypes.UUID;
    var isDefaultValueFunction = (typeof column.defaultValue) === 'function' ||
      (canHaveDynamicDefaultValue && (typeof column.defaultValue) === 'object');

    if (!_.isNull(column.defaultValue) && !_.isUndefined(column.defaultValue)) {
      // NOTICE: Prevent sequelize.Sequelize.NOW to be defined as the default value as the client
      //         does not manage it properly so far.
      if (isDefaultValueFunction) {
        schema.isRequired = false;
      } else {
        // NOTICE: Do not use the primary keys default values to prevent issues with UUID fields
        //         (defaultValue: DataTypes.UUIDV4).
        if (!_.includes(_.keys(model.primaryKeys), column.fieldName)) {
          schema.defaultValue = column.defaultValue;
        }
      }
    }

    schema.validations = getValidations(isDefaultValueFunction);

    if (schema.validations.length === 0) {
      delete schema.validations;
    }

    return schema;
  };
}

module.exports = ApimapFieldBuilder;
