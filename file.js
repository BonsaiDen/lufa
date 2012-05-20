var lexer = require('./lexer'),
    Parser = require('./Parser').Parser,
    util = require('util'),
    fs = require('fs');

function extend(a, b) {

    for(var i in b) {
        if (b.hasOwnProperty(i) && !a.hasOwnProperty(i)) {
            a[i] = b[i];
        }
    }

    return a;

}

function Scope(base, parent, node) {

    this.level = parent ? parent.level + 1 : 0;
    this.base = base || null;
    this.parent = parent || null;
    this.node = node;
    this.tree = node;
    this.names = {};

    this.errors = [];
    this.warnings = [];

    // Sub scopes to be compile later on
    this.subScopes = [];

    // Expressions which need to be validated later on
    this.expressions = [];

}

Scope.prototype = {

    // Run over the top level of the tree and parse all statements
    compile: function() {

        console.log('compiling scope on level', this.level);

        for(var i = 0, l = this.tree.length; i < l; i++) {

            var node = this.tree[i];
            if (this['compile_' + node.id]) {
                this['compile_' + node.id](node);

            } else {
                this.compileExpression(node);
            }

        }

        console.log('Names:', this.getNames());

        console.log('Errors:');
        for(var i = 0, l = this.errors.length; i < l; i++) {
            console.log('-', this.errors[i]);
        }

        return this.subScopes;

    },

    // Compile all the sub scopes, level per level
    compileSubScopes: function() {

        var subs = this.subScopes;
        while(subs.length) {

            var subScopes = subs;
            subs = [];
            for(var i = 0, l = subScopes.length; i < l; i++) {

                // Compile the sub scope and append its sub scopes into the list for the next level
                subs.push.apply(subs, subScopes[i].compile());

            }

        }

    },

    // Handle compilation of different statements
    compile_VARIABLE: function(v) {
        this.defineName(v);
        this.expressions.push(v);
    },

    compile_FUNCTION: function(func) {
        this.defineName(func);
        this.subScopes.push(new FunctionScope(this.base, this, func));
    },

    compile_CLASS: function(clas) {
        //console.log('class', clas);
    },

    compile_ASSIGN: function(assign) {
        //console.log('assign', assign);
    },

    compileExpression: function(exp) {
        //console.log('expression', exp);
    },

    // Define and resolve names
    defineName: function(node) {

        if (this.names.hasOwnProperty(node.name)) {
            this.error(node, this.names[node.name], 'A variable called "%name" was already defined in current scope at %opos as type of %otype, but %pos tries to redefine it as type of %type.');

        } else {
            this.names[node.name] = node;
        }

    },

    resolveName: function(node) {

    },

    getType: function(node) {

        var type = node.type,
            string = '';

        // Handle function types
        if (type.isFunction) {
            // stuff like void(int, string) func = ...

        } else {

            var inner = [];

            // TODO move "inner" into the type object itself?
            if (node.inner) {
                for(var i = 0, l = node.inner.length; i < l; i++) {
                    inner.push(this.getType(node.inner[i]));
                }
            }

            string = inner.length ? type.value + '[' + inner.join(', ') + ']' : type.value;

        }

        // TODO show other modifiers as well
        if (node.isConst) {
            string = '(const)' + string;
        }

        if (node.id === 'FUNCTION') {
            return '<function:' + string + '>';

        } else if (node.id === 'CLASS') {
            return '<class:' + string + '>';

        } else {
            return '<' + string + '>';
        }

    },

    getNames: function() {

        var names = [];
        for(var i in this.names) {
            if (this.names.hasOwnProperty(i)) {
                names.push(this.names[i].name + this.getType(this.names[i]));
            }
        }

        return names.join(', ');

    },

    error: function(node, other, msg) {

        msg = 'CompileError: ' + msg;

        msg = msg.replace('%oname', other.name);
        msg = msg.replace('%otype', this.getType(other));
        msg = msg.replace('%opos', 'line ' + other.line + ', col ' + other.col);

        msg = msg.replace('%name', node.name);
        msg = msg.replace('%type', this.getType(node));
        msg = msg.replace('%pos', 'line ' + node.line + ', col ' + node.col);

        this.errors.push(msg);

    }

};


function ModuleScope(base, parent, node) {
    Scope.call(this, base, parent, node);
    this.imports = {};
    this.exports = {};
}

extend(ModuleScope.prototype, Scope.prototype);


function FunctionScope(base, parent, node) {
    Scope.call(this, base, parent, node);
    this.tree = this.node.body;
}

FunctionScope.prototype = {

    compile: function() {
        this.compileParams(this.node.params);
        Scope.prototype.compile.call(this);
        return this.subScopes;
    },

    compileParams: function(params) {

        // Define all parameter names and save the expressions for later validation
        // TODO have a better error message for distinguishing paramters later
        // TODO put out a warning in case one of these shadows a name from a top level scope
        for(var i = 0, l = params.length; i < l; i++) {

            var param = params[i];
            this.defineName(param);
            this.expressions.push(param);

            /*
            if (this.parent.resolveName(param)) {
                this.warning(param, topName, 'Parameter "%name" at %pos shadows definition from top level at %opos');
            }
             */
        }

    }

};


function ClassScope(base, parent, node) {
    Scope.call(this, base, parent, node);
    //this.tree = this.node.body;
}

ClassScope.prototype = {

    compile: function() {

        // Define members
        for(var i = 0, l = this.node.members; i < l; i++) {
            var member = this.node.members[i];

        }

        // Define methods
        for(var i = 0, l = this.node.methods; i < l; i++) {
            var method = this.node.methods[i];

            // Define method as member, and create sub scope for function
            // TODO define here
            this.subScopes.push(new FunctionScope(this, this, method));

        }

        return this.subScopes;

    }

};


extend(FunctionScope.prototype, Scope.prototype);


// Compile a Module -----------------------------------------------------------
// ----------------------------------------------------------------------------
function Module(filename) {

    var source = fs.readFileSync(filename).toString(),
        tokens = lexer.parse(source, 4, true),
        p = new Parser();

    this.tree = p.parse(tokens);
    //console.log(util.inspect(this.tree, false, 10));

    this.scope = new ModuleScope(this, null, this.tree);
    this.scope.compile();
    this.scope.compileSubScopes();

}

Module.prototype = {

};


var e = new Module('test/compile.lf');

