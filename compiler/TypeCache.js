
/**
  * Copyright (c) 2012 Ivo Wetzel.
  *
  * Permission is hereby granted, free of charge, to any person obtaining a copy
  * of this software and associated documentation files (the "Software"), to deal
  * in the Software without restriction, including without limitation the rights
  * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
  * copies of the Software, and to permit persons to whom the Software is
  * furnished to do so, subject to the following conditions:
  *
  * The above copyright notice and this permission notice shall be included in
  * all copies or substantial portions of the Software.
  *
  * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
  * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
  * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
  * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
  * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
  * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
  * THE SOFTWARE.
  */

var Class = require('../lib/Class').Class;


// Base Type Classes ----------------------------------------------------------
// ----------------------------------------------------------------------------
var baseTypeClasses = {

    '$function': {

        methods: {

        },

        members: {

        }

    },

    'string': {

        methods: {
            'upper': {
                'params': []
            }
        },

        members: {
            'length': 'int'
        }

    },

    'bool': {

        methods: {

        },

        members: {

        }

    },

    'int': {

        methods: {

        },

        members: {

        }

    },

    'float': {

        methods: {

        },

        members: {

        }

    },

    'list': {

        methods: {

        },

        members: {

        }

    },

    'map': {

        methods: {

        },

        members: {

        }

    },

    'hash': {

        methods: {

        },

        members: {

        }

    },

    'void': {}

};


// ----------------------------------------------------------------------------
var TypeCache = Class(function() {

    this.cached = {};
    this.userClasses = {};

}, {

    _resolveTypeClass: function(id) {

        if (baseTypeClasses.hasOwnProperty(id)) {
            return baseTypeClasses[id];

        // How to lookup user types here?
        } else if (this.userClasses.hasOwnProperty(id)) {
            return this.userClasses[id];

        } else {
            throw new TypeError('Unknown type class: ' + id);
        }

    },

    _resolveTypeId: function(type) {

        if (type.isBuiltin) {

            if (baseTypeClasses.hasOwnProperty(type.value)) {
                return type.value;

            } else {
                throw new Error('Cannot map type to builtin: ' + type.value);
            }

        } else {
            // TODO ???
        }

    },


    // Get a type identifier from custom arguments ----------------------------
    getIdentifierFromArgs: function(type, isConst, isFunction) {

        var id;
        if (typeof type === 'string') {
            id = this._resolveTypeId({
                isBuiltin: true,
                value: type
            });

        } else {
            id = this._resolveTypeId(type);
            isConst = isConst || type.isConst;
            isFunction = isFunction || type.isFunction;
        }

        var value = {
            id: id,
            isFunction: isFunction || false,
            isConst: isConst || false,
            isList: id === 'list',
            isMap: id === 'map',
            isName: false,
            typeClass: this._resolveTypeClass(id)
        };

        value.id = (isConst ? 'const~' : '') + id;

        return value;

    },

    // Get a list identifier for the given sub type ---------------------------
    getListIdentifier: function(sub) {
        return {
            id: sub ? 'list[' + sub.id + ']' : 'list',
            isFunction: false,
            isConst: false,
            isMap: false,
            isList: true,
            isName: false,
            typeClass: this._resolveTypeClass('list'),
            sub: [sub]
        };
    },

    getMapIdentifier: function(key, value) {
        return {
            id: key && value  ? 'map[' + key.id + ',' + value.id + ']' : 'map',
            isFunction: false,
            isConst: false,
            isMap: true,
            isList: false,
            isName: false,
            typeClass: this._resolveTypeClass('map'),
            sub: [key, value]
        };
    },


    $constEx: /const~/g,

    $cleanId: function(id) {
        return id.replace(TypeCache.$constEx, '');
    },

    // Compare two type identifiers -------------------------------------------
    compare: function(left, right) {

        if (!right) {
            return false;
        }

        if (left.isFunction || right.isFunction) {
            return left.id === right.id;

        } else {
            return TypeCache.$cleanId(left.id) === TypeCache.$cleanId(right.id);
        }

    },

    // Resolve a type identifier from a token ---------------------------------
    getFromToken: function(node) {

        if (this.cached.hasOwnProperty(node.name)) {
            return this.cached[node.name];
        }

        this.cached[node.name] = this.getIdentifier(node.type, node);
        this.cached[node.name].isName = true;
        return this.cached[node.name];

    },

    // Resolve a type identifier from several parameters ----------------------
    getIdentifier: function(type, node, parent, getReturn) {

        var that = this;

        // Parses parameters for functions
        function getParams(params, value) {

            var paramList = [],
                paramIds = [];

            for(var i = 0, l = params.length; i < l; i++) {
                var param = that.getIdentifier(params[i].type);
                paramList.push(param);
                paramIds.push(param.id);
            }

            value.id += '(' + paramIds.join(',') + ')';
            value.params = paramList;

        }

        // Parses sub type for lists, hashes and maps
        function getSub(type, value) {

            if (type.sub) {

                var subList = [],
                    subIds = [];

                for(var i = 0, l = type.sub.length; i < l; i++) {
                    var subType = that.getIdentifier(type.sub[i]);
                    subList.push(subType);
                    subIds.push(subType.id);
                }

                value.id += '[' + subIds.join(',') + ']';
                value.sub = subList;

            } else {
                value.sub = null;
            }

        }

        var value = null;

        // Function definitions
        // TODO unify with below....
        if (node && node.id === 'FUNCTION') {

            var ret = this.getIdentifier(type);
            value = {
                id: ret.id, // this is a plain id for comparison
                returnType: ret,
                isFunction: true,
                isConst: type.isConst || false, // TODO does this need to be node.isConst?
                isList: false,
                isMap: false,
                isName: false,
                typeClass: this._resolveTypeClass('$function'),
                requiredParams: node.requiredParams
            };

            value.id += '<function';
            getParams(node.params, value);

        // "plain" types
        } else if (type.isBuiltin && !type.hasOwnProperty('returns')) {

            value = this.getIdentifierFromArgs(type, node ? node.isConst : false);
            getSub(type, value);

            // Get the identifier of the return type of the function
            if (type.isFunction && !getReturn) {

                value.typeClass = this._resolveTypeClass('$function');
                value.id += '<function';
                value.returnType = this.getIdentifier(type, null, null, true);
                value.requiredParams = type.requiredParams;

                getParams(type.params, value);

            }

        // Function return types
        } else if (type.isFunction && type.returns != null) {

            value = {
                id: 'function', // this is a plain id for comparison
                returnType: null,
                isFunction: true,
                isConst: type.isConst || false,
                isList: false,
                isMap: false,
                isName: false
            };

            value.returnType = this.getIdentifier(type.returns, null, value);
            getParams(type.params, value);

        // Search userType classes or something like that...
        } else {
            console.log('UNKNOWN', type);
            //this.scope.error(node, null, 'Unkown type "' + type.value + '".');
            throw new TypeError('Unknown type: ' + type.value);
        }

        if (parent) {
            parent.id = value.id + '<' + parent.id;
        }

        return value;

    }

});

module.exports = TypeCache;

