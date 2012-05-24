var lexer = require('./parser/lexer'),
    Parser = require('./parser/Parser').Parser,
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

    this.types = {};
    this.names = {};

    this.errors = [];
    this.warnings = [];

    // Sub scopes to be compile later on
    this.subScopes = [];

    // Expressions which need to be validated later on
    this.expressions = [];

    this.type = 'block';

}

Scope.prototype = {

    // Run over the top level of the tree and parse all statements
    compile: function() {

        var returned = false,
            node = null;

        for(var i = 0, l = this.tree.length; i < l; i++) {

            if (returned) {
                this.error(node, this.tree[i], 'Dead code after return statement at %pos, %oinfo at %opos is never reached.');
                break;
            }

            node = this.tree[i];
            if (this['compile_' + node.id]) {
                returned |= this['compile_' + node.id](node);

            } else {
                this.compileExpression(node);
            }

        }

        console.log('Scope on level', this.level, 'names:', this.getNames());
        for(var i = 0, l = this.errors.length; i < l; i++) {
            console.log('   Error:', this.errors[i]);
        }

        return this.subScopes;

    },

    // compile all the sub scopes, level per level
    compileSubScopes: function() {

        var subs = this.subScopes;
        while(subs.length) {

            var subScopes = subs;
            subs = [];
            for(var i = 0, l = subScopes.length; i < l; i++) {

                // compile the sub scope and append its sub scopes into the list for the next level
                subs.push.apply(subs, subScopes[i].compile());

            }

        }

    },

    // Handle compilation of different statements
    compile_VARIABLE: function(v) {

        this.defineName(v);

        // Detect hash declaration and create user types
        if (v.type.value === 'hash' && v.right && v.right.id === 'HASHDEC') {

            this.types[v.name] = v;
            for(var i in v.right.fields) {
                if (v.right.fields.hasOwnProperty(i)) {
                    this.expressions.push(v.right.fields[i]);
                }
            }

        } else {
            this.expressions.push(v);
        }

        // TODO Do type resolution later, but COMPARE LINE NUMBERS!!!! To ensure it can compile

    },

    compile_FUNCTION: function(func) {
        this.defineName(func);
        this.subScopes.push(new FunctionScope(this.base, this, func));
    },

    compile_IF: function(iff) {

        this.expressions.push(iff.condition);
        this.subScopes.push(new Scope(this.base, this, iff.body));

        for(var i = 0, l = iff.branches.length; i < l; i++) {

            if (iff.condition) {
                this.expressions.push(iff.condition);
            }

            this.subScopes.push(new Scope(this.base, this, iff.branches[i].body));

        }

    },

    compile_CLASS: function(clas) {
        this.defineName(clas);
        this.types[clas.name] = clas;
        this.subScopes.push(new ClassScope(this.base, this, clas));
    },

    compile_ASSIGN: function(assign) {
        // TODO check stuff and add expressions
        //console.log('assign', assign);
    },

    compile_RETURN: function(ret) {

        // go up scope and find the matching function
        var scope = this;
        while(scope) {
            if (scope.type === 'function') {
                console.log('found function for return:', ret, scope.node.name + this.getType(scope.node));

                // TODO check return type later
                scope.returns.push(ret);
                break;

            }

            scope = scope.parent;

        }

        if (scope === null) {
            this.error(ret, null, 'Return statement outside of function at %pos.');
        }

        return true;

    },

    compile_IMPORT: function(imp) {

        for(var i = 0, l = imp.names.length; i < l; i++) {

            var name = imp.names[i];
            if (name.as) {
                this.defineName(name.as);

            } else {
                this.defineName(name);
            }

        }
    },

    compileExpression: function(exp) {
        this.expressions.push(exp);
    },

    defineName: function(node) {

        if (this.names.hasOwnProperty(node.name)) {
            var name = this.names[node.name];
            this.error(node, name, 'A variable called "%name" was already '
                                    + (name.isImport ? 'imported into the' : 'defined in the')
                                    + ' current scope at %opos as type of %otype, but %pos tries to '
                                    + (node.isImport ? 're-import' : 're-defined')
                                    + ' it as type of %type.');

        } else {
            this.names[node.name] = node;
        }

    },

    compareTypes: function(a, b) {

    },

    resolveName: function(node) {

    },

    // this functions returns members, methods and other things like indexability for
    // compilation
    resolveType: function(node) {

        var type = node.type;

        if (!type.builtin) {

        } else {
            // return a predefined built in for now, later get this from code or something
        }

    },

    getType: function(node) {

        if (node.isImport) {
            return '<unresolved import>';
        }

        if (!node.type) {
            return '<non-type token>';
        }

        var type = node.type,
            string = '';

        // TODO Resolve user types here
        if (!type.builtin) {

        }

        // Handle function types
        if (type.isFunction) {
            // stuff like void(int, string) func = ...

        } else {

            var inner = [];
            if (type.sub) {
                for(var i = 0, l = type.sub.length; i < l; i++) {
                    inner.push(this.getType({
                        type: type.sub[i]
                    }));
                }
            }

            string = inner.length ? type.value + '[ ' + inner.join(', ') + ' ]' : type.value;

        }

        // TODO show other modifiers as well
        if (node.isConst) {
            string = '(const)' + string;
        }

        if (node.id === 'FUNCTION') {
            return ':(function)' + string;

        } else if (node.id === 'CLASS') {
            return ':(class)' + string;

        } else {
            return ':' + string;
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

    getInfo: function(node) {
        if (node.id === 'CLASS') {
            return '[Class ' + node.name + ']';
        }
    },

    error: function(node, other, msg) {

        // Clean this up...
        other && (msg = msg.replace('%oinfo', this.getInfo(other)));
        other && other.name && (msg = msg.replace('%oname', other.name));
        other && (msg = msg.replace('%otype', this.getType(other)));
        other && (msg = msg.replace('%opos', 'line ' + other.line + ', col ' + other.col));

        node && (msg = msg.replace('%info', this.getInfo(node)));
        node && node.name && (msg = msg.replace('%name', node.name));
        node && (msg = msg.replace('%type', this.getType(node)));
        node && (msg = msg.replace('%pos', 'line ' + node.line + ', col ' + node.col));

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
    this.type = 'function';
    this.returns = [];
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

extend(FunctionScope.prototype, Scope.prototype);


function ClassScope(base, parent, node) {

    Scope.call(this, base, parent, node);
    this.type = 'class';
    this.members = {};
    //this.tree = this.node.body;

}

ClassScope.prototype = {

    compile: function() {

        // Constructor
        if (this.node.constructor) {
            this.subScopes.push(new FunctionScope(this, this, this.node.constructor));
        }

        // Destructor
        if (this.node.destructor) {
            this.subScopes.push(new FunctionScope(this, this, this.node.destructor));
        }

        // Define members
        for(var i in this.node.members) {

            if (this.node.members.hasOwnProperty(i)) {
                var member = this.node.members[i];
                this.defineMember(member);
                this.expressions.push(member);
            }

        }

        // Define methods
        for(var i in this.node.methods) {

            var method = this.node.methods[i];
            this.defineMember(method);

            // Define method as member, and create sub scope for function
            // TODO define here
            this.subScopes.push(new FunctionScope(this, this, method));

        }

        return this.subScopes;

    },

    defineMember: function(node) {

        if (this.members.hasOwnProperty(node.name)) {
            var name = this.members[node.name];
            this.error(node, name, 'A member called "%name" was already '
                                    + 'defined in the'
                                    + ' current class at %opos as type of %otype, but %pos tries to '
                                    + 're-defined'
                                    + ' it as type of %type.');

        } else {
            this.members[node.name] = node;
        }

    }

};

// class user types
// class parent classes

extend(ClassScope.prototype, Scope.prototype);


// Compile a Module -----------------------------------------------------------
// ----------------------------------------------------------------------------
function Module(filename) {

    var source = fs.readFileSync(filename).toString(),
        tokens = lexer.parse(source, 4, true),
        p = new Parser();

    this.tree = p.parse(tokens);
    console.log(util.inspect(this.tree, false, 10));

    this.scope = new ModuleScope(this, null, this.tree);
    this.scope.compile();
    this.scope.compileSubScopes();

}

Module.prototype = {

};

var e = new Module('test/compile.lf');

