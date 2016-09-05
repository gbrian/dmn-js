'use strict';

var assign = require('lodash/object/assign');

var domify     = require('min-dom/lib/domify'),
    domClasses = require('min-dom/lib/classes'),
    utils      = require('./utils');

var parseString        = utils.parseString,
    parseAllowedValues = utils.parseAllowedValues,
    isStringCell       = utils.isStringCell;

function StringEdit(eventBus, simpleMode, elementRegistry, graphicsFactory) {
  this._eventBus = eventBus;
  this._simpleMode = simpleMode;
  this._elementRegistry = elementRegistry;
  this._graphicsFactory = graphicsFactory;

  var refreshHandler = function() {
    if (this._simpleMode.isActive()) {
      this.refresh();
    }
  };
  this._eventBus.on('simpleMode.activated', this.setupComplexCells, this);
  this._eventBus.on('simpleMode.deactivated', this.teardownComplexCells, this);
  this._eventBus.on('typeRow.editDataType', refreshHandler, this);
  this._eventBus.on('typeRow.editAllowedValues', refreshHandler, this);
  this._eventBus.on('typeRow.editAllowedValues', refreshHandler, this);
  this._eventBus.on('contentNode.created', refreshHandler, this);

  // whenever an type cell is opened, we have to position the template, because the x offset changes
  // over time, when columns are added and deleted
  this._eventBus.on('complexCell.open', function(evt) {
    var config = evt.config;

    if (config.type === 'stringEdit') {
      var gfx = elementRegistry.getGraphics(config.element);
      var template = config.template;

      assign(template.parentNode.style, {
        left: (gfx.offsetLeft + gfx.offsetWidth - 10) + 'px'
      });
    }
  });

}

StringEdit.prototype.refresh = function() {
  this.teardownComplexCells();
  this.setupComplexCells();
};

StringEdit.prototype.setupComplexCells = function() {
  var graphicsFactory = this._graphicsFactory;
  var elementRegistry = this._elementRegistry;
  var eventBus = this._eventBus;

  var self = this;
  elementRegistry.forEach(function(element) {
    if (isStringCell(element)) {
      var parsed = parseString(element.content.text);

      if (element.content.text && !parsed) {
        // in this case, the date contains an expression, we should not show the date editor here

        // show nothing instead
        element.complex = {
          template: domify('<div>'),
          element: element,
          type: 'stringEdit',
          offset: {
            x: 0,
            y: 0
          }
        };

        graphicsFactory.update('cell', element, elementRegistry.getGraphics(element));
        return;
      }

      var node = domify(require('./template.html'));



      // set the initial state based on the cell content
      var allowedValues = parseAllowedValues(element);
      self.updateElementVisibility(parsed.type, allowedValues, node);

      // select the correct dropdown option
      node.querySelector('.string-type-dropdown').value = parsed.type;

      if(!allowedValues) {
        console.log('setup no allowed values fields');
      } else {
        console.log('setup allowed values fields');
      }

      // wire the elements
      node.querySelector('.string-type-dropdown').addEventListener('change', function(evt) {
        var type = evt.target.value;

        self.updateElementVisibility(type, allowedValues, node);
      });


      var complexCellConfig = {
        className: 'dmn-string-editor',
        template: node,
        element: element,
        type: 'stringEdit',
        offset: {
          x: 0,
          y: 0
        }
      };

      eventBus.on('complexCell.close', function(complexCell) {
        if (complexCell.config === complexCellConfig) {
          console.log('should update cell', element);
          //TODO: acutally update the cell
        }
      });

      element.complex = complexCellConfig;

      graphicsFactory.update('cell', element, elementRegistry.getGraphics(element));
    }
  });
};

StringEdit.prototype.updateElementVisibility = function(type, allowedValues, node) {
  if(type) {
    node.querySelector('.input-values').style.display = allowedValues ? 'block' : 'none';
    node.querySelector('.free-input').style.display = !allowedValues ? 'block' : 'none';
  } else {
    node.querySelector('.input-values').style.display = 'none';
    node.querySelector('.free-input').style.display = 'none';
  }
};

StringEdit.prototype.teardownComplexCells = function() {
  var graphicsFactory = this._graphicsFactory;
  var elementRegistry = this._elementRegistry;

  elementRegistry.forEach(function(element) {
    if (element.complex && element.complex.type === 'stringEdit') {

      delete element.complex;

      graphicsFactory.update('cell', element, elementRegistry.getGraphics(element));
    }
  });
};

StringEdit.$inject = ['eventBus', 'simpleMode', 'elementRegistry', 'graphicsFactory'];

module.exports = StringEdit;
