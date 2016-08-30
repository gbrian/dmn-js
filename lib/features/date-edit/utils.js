'use strict';

function hasDateType(column) {
  return column &&
         (column.inputExpression &&
         column.inputExpression.typeRef === 'date' ||
         column.typeRef === 'date');
}

function isBodyRow(row) {
  return !row.isHead && !row.isFoot;
}


function isISODateString(dateString) {
  return /\d{4}(?:-\d\d){2}T(?:\d\d:){2}\d\d/.test(dateString);
}

module.exports.isISODateString = isISODateString;

function getSampleDate(alternative) {
  var date = new Date();
  if (alternative) {
    date.setUTCHours(23, 59, 59, 0);
  } else {
    date.setUTCHours(0, 0, 0, 0);
  }

  return date.toISOString().slice(0,-5);
}

module.exports.getSampleDate = getSampleDate;

function isDateCell(el) {
  return el._type === 'cell' &&
    hasDateType(el.column.businessObject) &&
    isBodyRow(el.row);
}

module.exports.isDateCell = isDateCell;


function parseDate(dateString) {
  // try between
  var info = dateString.match(/^\[date and time\("(\d{4}(?:-\d\d){2}T(?:\d\d:){2}\d\d)"\)..date and time\("(\d{4}(?:-\d\d){2}T(?:\d\d:){2}\d\d)"/);
  if (info) {
    return {
      type: 'between',
      date1: info[1],
      date2: info[2]
    };
  }

  // try before and after
  info = dateString.match(/^(<|>)\s*date and time\("(\d{4}(?:-\d\d){2}T(?:\d\d:){2}\d\d)"\)/);
  if (info) {
    return {
      type: info[1] === '<' ? 'before' : 'after',
      date1: info[2]
    };
  }

  // try exact date
  info = dateString.match(/^date and time\("(\d{4}(?:-\d\d){2}T(?:\d\d:){2}\d\d)"\)$/);
  if (info) {
    return {
      type: 'exact',
      date1: info[1]
    };
  }
}

module.exports.parseDate = parseDate;
