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

      // add the initial data nodes
      if(parsed.values && !allowedValues) {
        console.log('setup no allowed values fields', parsed.values);
        self.renderValues(parsed.values, node.querySelector('.free-input ul'));
      }
      if(allowedValues) {
        console.log('setup allowed values fields', parsed.values);
      }

      // wire the elements
      node.querySelector('.string-type-dropdown').addEventListener('change', function(evt) {
        var type = evt.target.value;
        parsed.type = type;
        self.updateElementVisibility(type, allowedValues, node);
      });

      if(!allowedValues) {
        node.querySelector('.free-input input').addEventListener('keydown', function(keyboardEvt) {
          if (keyboardEvt.keyCode === 13 && keyboardEvt.target.value.indexOf('"') === -1) {
            var values = keyboardEvt.target.value.split(',');
            values.forEach(function(value) {
              parsed.values.push(value.trim());
            });
            self.renderValues(parsed.values, node.querySelector('.free-input ul'));
            keyboardEvt.target.value = '';
          }
        });

        node.querySelector('.free-input input').addEventListener('input', function(keyboardEvt) {
          // validate input
          var val = keyboardEvt.target.value;

          if (val.indexOf('"') === -1) {
            // is valid
            domClasses(keyboardEvt.target).remove('invalid');
            node.querySelector('.free-input .helptext').style.display = 'none';
          } else {
            // is invalid
            domClasses(keyboardEvt.target).add('invalid');
            node.querySelector('.free-input .helptext').style.display = 'block';
          }

        });


      }

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
          self.setCellContent(parsed, element);
          graphicsFactory.update('cell', element, elementRegistry.getGraphics(element));
        }
      });

      element.complex = complexCellConfig;

      graphicsFactory.update('cell', element, elementRegistry.getGraphics(element));
    }
  });
};

StringEdit.prototype.setCellContent = function(data, element) {
  if(data.type === '') {
    return element.content.text = '';
  }

  var values = data.values.map(function(value) {
    return '"' + value + '"';
  }).join(', ');

  if(data.type === 'negation') {
    return element.content.text = 'not(' + values + ')';
  } else {
    return element.content.text = values;
  }
};

StringEdit.prototype.renderValues = function(values, container) {
  var self = this;
  container.innerHTML = '';
  values.forEach(function(value) {
    var valueNode = domify('<li><span class="value-text"></span><button class="dmn-icon-clear"></button></li>');
    valueNode.querySelector('.value-text').textContent = value;
    valueNode.querySelector('button').addEventListener('click', function(evt) {
      values.splice(values.indexOf(value), 1);
      self.renderValues(values, container);
    });
    container.appendChild(valueNode);
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
