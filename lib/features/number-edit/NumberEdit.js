'use strict';

var assign = require('lodash/object/assign'),
    forEach = require('lodash/collection/forEach');

var domify = require('min-dom/lib/domify'),
    domQuery = require('min-dom/lib/query'),
    domClasses = require('min-dom/lib/classes');

var isNumberCell = require('./utils').isNumberCell;

var htmlTemplate = require('./template.html');

var OPERATORS = [
  [ 'equals', '=' ],
  [ 'less', '<' ],
  [ 'less-equal', '<=' ],
  [ 'greater', '>' ],
  [ 'greater-equal', '>=' ]
];

function getOperator(text) {
  var operator, index;

  forEach(OPERATORS, function(option, idx) {
    index = option.indexOf(text);

    if (index === -1) {
      return;
    }

    // we want to get the opposite operator
    operator = option[ index ? 0 : 1 ];

    index = idx;

    return false;
  });

  return {
    operator: operator,
    index: index
  };
}


function NumberEdit(eventBus, simpleMode, elementRegistry, graphicsFactory, modeling, complexCell) {
  this._eventBus = eventBus;
  this._simpleMode = simpleMode;
  this._elementRegistry = elementRegistry;
  this._graphicsFactory = graphicsFactory;
  this._modeling = modeling;
  this._complexCell = complexCell;

  eventBus.on('simpleMode.activated', this.setupComplexCells, this);
  eventBus.on('simpleMode.deactivated', this.teardownComplexCells, this);

  eventBus.on('typeRow.editDataType', function() {
    if (simpleMode.isActive()) {
      this.refresh();
    }
  }, this);

  // whenever an type cell is opened, we have to position the template, because the x offset changes
  // over time, when columns are added and deleted
  eventBus.on('complexCell.open', function(evt) {
    var config = evt.config;

    if (config.type === 'numberEdit') {
      var gfx = elementRegistry.getGraphics(config.element);
      var template = config.template,
          text = config.element.content.text;

      config.editingType = this.getEditingType(text);

      if (config.editingType === null) {
        return;
      }

      if (config.editingType === 'range') {
        this.updateRangeNode(template, text);
      } else {
        this.updateComparisonNode(template, text);
      }

      assign(template.parentNode.style, {
        left: (gfx.offsetLeft + gfx.offsetWidth - 10) + 'px'
      });
    }
  }, this);

}

NumberEdit.$inject = [ 'eventBus', 'simpleMode', 'elementRegistry', 'graphicsFactory', 'modeling', 'complexCell' ];

module.exports = NumberEdit;


NumberEdit.prototype.refresh = function() {
  this.teardownComplexCells();
  this.setupComplexCells();
};

NumberEdit.prototype.setupComplexCells = function() {
  var graphicsFactory = this._graphicsFactory,
      elementRegistry = this._elementRegistry,
      eventBus = this._eventBus;

  var self = this;

  elementRegistry.forEach(function(element) {
    var editingType, text, node, complexCellConfig;

    if (isNumberCell(element)) {
      text = element.content.text;

      editingType = self.getEditingType(text);

      if (editingType === null) {
        // show nothing instead
        element.complex = {
          template: domify('<div>'),
          element: element,
          type: 'numberEdit',
          editingType: 'comparison',
          offset: {
            x: 0,
            y: 0
          }
        };

        return graphicsFactory.update('cell', element, elementRegistry.getGraphics(element));
      }

      node = domify(htmlTemplate);

      // click on Expression link switches to expression mode
      node.querySelector('.comparison').addEventListener('click', function() {
        domClasses(node.parentNode).remove('use-range');

        // focus the script expression input field
        node.querySelector('.comparison-number').focus();

        element.complex.editingType = 'comparison';
      });

      // click on Script link switches to script mode
      node.querySelector('.range').addEventListener('click', function() {

        domClasses(node.parentNode).add('use-range');

        node.querySelector('.include-inputs input[placeholder="start"]').focus();

        element.complex.editingType = 'range';
      });

      complexCellConfig = {
        className: 'dmn-number-editor',
        template: node,
        element: element,
        type: 'numberEdit',
        editingType: editingType,
        offset: {
          x: 0,
          y: 0
        }
      };

      eventBus.on('complexCell.close', function(complexCell) {
        if (complexCell.config === complexCellConfig) {
          self.updateCellContent(element, node);
        }
      });

      element.complex = complexCellConfig;

      graphicsFactory.update('cell', element, elementRegistry.getGraphics(element));
    }
  });
};

NumberEdit.prototype.getEditingType = function(text) {
  if (text === '' || /(\[|\]){1,}|(<|>|=){1,}|([0-9]){1,}/.test(text)) {
    return /\[|\]/.test(text) ? 'range' : 'comparison';
  }

  return null;
};

NumberEdit.prototype.updateComparisonNode = function(template, text) {
  var numberNode = template.querySelector('.comparison-number');

  var parsedText,
      dropdownIndex,
      number;

  if (text) {
    parsedText = text.split(' ');

    if (parsedText.length === 1) {
      dropdownIndex = 0;

      number = text;
    } else {
      dropdownIndex = getOperator(parsedText[0]).index;

      number = parsedText[1];
    }

    template.querySelector('.comparison-dropdown').selectedIndex = dropdownIndex;

    numberNode.value = number;
  }

  domClasses(template.parentNode).remove('use-range');

  numberNode.focus();
};

NumberEdit.prototype.parseRangeString = function(text) {
  var parsedText = text.match(/([^\[\]]*)(?:\.\.)([^\[\]]*)/);

  if (!parsedText) {
    return null;
  }
  return parsedText.splice(1);
};

NumberEdit.prototype.updateRangeNode = function(template, text) {
  var startNode = domQuery('.range input[placeholder="start"]', template),
      isStartIncludedNode = domQuery('.range input[placeholder="include-start"]', template),
      endNode = domQuery('.range input[placeholder="end"]', template),
      isEndIncludedNode = domQuery('.range input[placeholder="include-end"]', template),
      brackets,
      parsedNumbers;

  if (text) {
    parsedNumbers = this.parseRangeString(text);

    if (parsedNumbers && parsedNumbers.length === 2) {
      brackets = text.match(/\[|\]/g);

      startNode.value = parsedNumbers[0];
      isStartIncludedNode.checked = brackets[0] === '[';

      endNode.value = parsedNumbers[1];
      isEndIncludedNode.checked = brackets[1] === ']';
    }
  }

  domClasses(template.parentNode).add('use-range');

  template.querySelector('.include-inputs input[placeholder="start"]').focus();
};

NumberEdit.prototype.updateCellContent = function(element, node) {
  var modeling = this._modeling;

  if (!element.complex) {
    return;
  }

  var editingType = element.complex.editingType,
      content;

  if (editingType === 'comparison') {
    content = this.parseComparison(node);
  } else {
    content = this.parseRange(node);
  }

  modeling.editCell(element.row.id, element.column.id, content);
};

NumberEdit.prototype.parseComparison = function(node) {
  var dropdown = domQuery('.comparison-dropdown', node),
      numberNode = domQuery('.comparison-number', node),
      numberValue = numberNode.value,
      operator;

  var dropdownValue = dropdown.children[dropdown.selectedIndex].value;

  if (!numberValue) {
    return '';
  }

  operator = getOperator(dropdownValue).operator;

  // don't show the equal operator
  operator = operator === '=' ? '' : operator + ' ';

  return operator + numberValue;
};

NumberEdit.prototype.parseRange = function(node) {
  var start = domQuery('.range input[placeholder="start"]', node).value,
      isStartIncluded = domQuery('.range input[placeholder="include-start"]', node).checked,
      end = domQuery('.range input[placeholder="end"]', node).value,
      isEndIncluded = domQuery('.range input[placeholder="include-end"]', node).checked;

  var startBracket = isStartIncluded ? '[' : ']',
      endBracket = isEndIncluded ? ']' : '[';

  if (!start || !end) {
    return '';
  }

  return startBracket + start + '..' + end + endBracket;
};

NumberEdit.prototype.teardownComplexCells = function() {
  var graphicsFactory = this._graphicsFactory;
  var elementRegistry = this._elementRegistry;

  elementRegistry.forEach(function(element) {
    if (element.complex && element.complex.type === 'numberEdit') {

      delete element.complex;

      graphicsFactory.update('cell', element, elementRegistry.getGraphics(element));
    }
  });
};
