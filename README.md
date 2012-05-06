lufa - A work in progress static language
-----------------------------------------

Tokenizer is fully working, the Parser is only partly done due to the fact that there's
still a lot of experimentation going on the the syntax of the language.


## Planned Features

- Syntax inspired by JavaScript / Python / Ruby:
    
    - Whitespace is significant
    - Functions are objects

- Static / strictly typed:
    
    - Types atm: int, float, string, bool, hash, list, map
    - Type casts in the form of "int a = (string)1"
    - Compiler with static analysis
    - User defined types via hashes / structures and classes

- Classes (not sure yet whether single or multi inheritance):
    
    - With static / private / protected methods and method overloading
    - Methods assigned to a variable will keep the instance context
    - Member access via "@" instead of "this"

- Functional features such as:
    
    - List comprehensions:

        list[int] squares = [i * i for int i in [1, 2, 3, 4]]

- Other things:
    
    - Default argument for functions
    - Default return for functions(still unsure about this)
    - "setter" args for functions (needs some more thought)

# License

**lufa** is licenses under MIT.
