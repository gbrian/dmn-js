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
    return string;
  }
}
