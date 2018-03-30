see if i can make something that work like react.  

create tree one. 



code => AST => graph nodes => evaluated values

evaluated value depends on a branch node in the graph
evaluated value may depend on a symbol reference that is a child of the branch node

branch depends on a block statement in the AST



three code blocks A,B,C
A defines symbol a
B depends on symbol a
C does not depend on anything else

A is processed, symbol a is updated
B receives an event that something it depends on is dirty
C does not get an event