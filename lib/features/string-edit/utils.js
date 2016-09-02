'use strict';

var hasStringType = function(column) {
  return column &&
         (column.inputExpression &&
         column.inputExpression.typeRef === 'string' ||
         column.typeRef === 'string');
};
var isBodyRow = function(row) {
  return !row.isHead && !row.isFoot;
};

module.exports = {
  isStringCell: function(el) {
    return el._type === 'cell' &&
      hasStringType(el.column.businessObject) &&
      isBodyRow(el.row);
  },
  parseString: function(string) {
    // three cases: empty, disjunction, and negated dijunction

    // try empty
    if(string.trim() === '') {
      return {
        type: ''
      };
    }

    // try disjunction
    var values = string.split(',');
    var out = {
      type: 'disjunction',
      values: []
    };
    var invalid = false;
    values.forEach(function(value) {
      if(/^"[^"]*"$/.test(value.trim())) {
        out.values.push(value.trim().slice(1,-1));
      } else {
        invalid = true;
      }
    });
    if(!invalid) {
      return out;
    }

    // try negation
    invalid = false;
    out.type = 'negation';
    out.values = [];

    var info = string.match(/^\s*not\((.*)\)\s*$/);
    if (info) {
      values = info[1].split(',');
      values.forEach(function(value) {
        if(/^"[^"]*"$/.test(value.trim())) {
          out.values.push(value.trim().slice(1,-1));
        } else {
          invalid = true;
        }
      });
      if(!invalid) {
        return out;
      }
    }
  },
  parseAllowedValues: function(el) {
    var bo = el.column.businessObject;
    var values = bo && (bo.inputValues || bo.outputValues);
    if(values && values.text) {
      values = values.text.split(',');
      return values.map(function(value) {
        if(value.charAt(0) === '"' && value.charAt(value.length - 1) === '"') {
          return value.slice(1,-1);
        } else {
          return value;
        }
      });
    }
  }
}
