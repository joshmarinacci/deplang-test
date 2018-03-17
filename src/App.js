import React, { Component } from 'react';
import ohm  from 'ohm-js'
import Graph from "./Graph"
import './App.css';

const grammar = ohm.grammar(`
    BasicSyntax {
        Block = Statement+
        Statement = Expr ("=>" Expr)*
        Expr = FunCall | String | Number | identifier
        Parameter = identifier ":" Expr
        identifier = letter (letter|digit)*
        String = "'" (~"'" any)* "'"
        Number = digit+
        FunCall = identifier "(" Arguments ")"
        Arguments = ListOf<Parameter, ",">
    }
`)

const PREDEFINED_FUNCTIONS = {
    'Image': function(ctx, args) {
        console.log(`Making Image with size ${args.width}x${args.height}`)
        const canvas = document.createElement('canvas')
        canvas.width = args.width
        canvas.height = args.height
        return canvas
    },
    'Circle': function(ctx, args) {
        return {
            type:'circle',
            cx:args.cx,
            cy:args.cy,
            radius:args.radius,
            fill:args.fill
        }
    },
    'Draw': function(ctx, args) {
        console.log("pretending to draw")
        let shape= args.shapes
        let image = args.image
        if(!image) image = args.input
        if(!image) throw new Error("no image for the draw command")
        console.log("  shapes", shape)
        console.log("  image",image)

        const c = image.getContext('2d')

        const cir = shape
        // c.fillRect(0,0,25,25)
        c.fillStyle = cir.fill
        c.beginPath()
        c.arc(cir.cx,cir.cy,cir.radius, 0, 360)
        c.closePath()
        c.fill()
        return image
    },
    'Save': function (ctx, args) {
        console.log("pretending to save ")
        console.log("  file ", args.filename)
        console.log("  image", args.input)
        return { type:'save-output'}
    },
    'Slider': function(ctx, args) {
        console.log("making a slider")
        return {
            type:'input',
            kind:'slider',
            min:0,
            max:100,
            value: 20,
            targetNode:ctx.node.id
        }
    }
}

function makeToGraphSemantics(graph, grammar) {
    return grammar.createSemantics().addOperation('toGraph', {
        Number: (a) => graph.makeLiteral(a.sourceString,parseInt(a.sourceString,10)),
        String: (_q1,str,_q2)  => graph.makeLiteral(str.sourceString,str.sourceString),
        identifier: function(str, rest) { return graph.makeSymbolReference(this.sourceString) },
        Arguments: (a) => a.asIteration().toGraph(),
        Parameter: (id, _, expr) => ({ name:id.sourceString, value:expr.toGraph() }),
        FunCall: function(id, op, params, cp) {
            const id_s = id.toGraph()
            const expr = graph.makeExpression(id_s.name)
            const args = params.toGraph()
            args.forEach(arg => graph.add(arg.value,expr,arg.name))
            return expr
        },
        Statement: function(first, _, rest) {
            const ret = {
                type:'statement',
                first:first.toGraph(),
                rest:rest.toGraph(),
            }
            // const rest_n = rest.toGraph()
            ret.rest.reduce((first,next)=>{
                if(next.type === 'symbolref') graph.SYMBOLS[next.name] = first
                if(next.type === 'expression') graph.add(first,next,'input')
                return next
            },ret.first)
            return ret
            // if(rest_n.length > 0) {
            //     console.log("returning", rest_n[rest_n.length-1])
            //     return rest_n[rest_n.length-1]
            // }
        },
        Block: function(statements) {
            return {
                type:'block',
                statements: statements.toGraph()
            }
        }
    })
}

function resolveValue(node) {
    if(node.type === 'literal') return Promise.resolve(node.value)
    if(node.type === 'symbolref') {
        return new Promise((res,rej)=>{
            const expr = node.graph.SYMBOLS[node.name]
            if(!expr) rej(new Error("symbol not defined: " + node.name, node))
            resolveValue(expr).then((ret)=>{
                res(ret)
            })
        })
    }
    if(node.type === 'block') {
        // console.log("it's a block. do the last statement.")
        const last = node.statements[node.statements.length-1]
        // console.log("last is", last.type)
        return resolveValue(last)
    }
    if(node.type === 'statement') {
        // console.log("its a statement",node)
        if(node.rest.length > 0) {
            const last = node.rest[node.rest.length-1]
            // console.log("last is",last)
            return resolveValue(last)
        }

    }
    if(node.type === 'expression') {
        return new Promise((res, rej) => {
            //it must be an expression
            const proms = Object.keys(node.inputs).map((key) => resolveValue(node.inputs[key]))
            return Promise.all(proms).then((rets) => {
                const args = {}
                Object.keys(node.inputs).forEach((key, i) => args[key] = rets[i])//resolveValue(node.inputs[key]))
                const fun = PREDEFINED_FUNCTIONS[node.name]
                console.log("calling function with node",node.id)
                if (fun) res(fun({node:node}, args))
                rej(new Error("no defined function", node.name))
            })
        })
    }

    console.log("ERROR: unrecognized type",node.type)
}

const src = `
    'blue' => BLUE
    Circle ( cx:25, cy:50, radius:20, fill:BLUE ) => circle1
    Circle ( cx:75, cy:50, radius:20, fill:'green' ) => circle2
    Image ( width: 100, height: 100 ) 
        => Draw ( shapes:circle1 ) 
        => Draw ( shapes:circle2 ) 
`

class InputPanel extends Component {
    constructor(props) {
        super(props)
        this.state = {
            source:`Slider(value:50)=>A`,
            output:'nothing',
            graph:null,
        }
    }
    evaluate = () =>{
        console.log("evaluating",this.state.source)
        const graph = new Graph()
        const sem = makeToGraphSemantics(graph,grammar)
        const match = grammar.match(this.state.source)
        const ret = sem(match).toGraph()
        const last = ret[ret.length-1]
        console.log("got the output",ret)
        this.setState({
            graph:graph,
            value:ret
        })
    }
    edited = (e)=> this.setState({source:e.target.value})
    keypressed = (e) => {
        if(e.keyCode === 13 && e.ctrlKey) {
            e.preventDefault()
            this.evaluate()
        }
    }
    render() {
        return (
            <div className={'input-panel'}>
                <textarea value={this.state.source}
                          onChange={this.edited}
                          rows={10} cols={80}
                          onKeyDown={this.keypressed}
                />
                <button onClick={this.evaluate}>evaluate</button>
                <OutputPanel graph={this.state.graph} value={this.state.value}/>
            </div>
        );
    }
}

class App extends Component {
    render() {
        return <div id="main">
            <InputPanel key="1"/>
            {/*<InputPanel key="2"/>*/}
        </div>
    }
}

class OutputPanel extends Component {
    constructor(props) {
        super(props)
        this.state = {
            value: null
        }
    }
    componentWillMount() {
        // console.log("mounting")
    }
    componentWillUnmount() {
        // console.log("unmounting")
    }
    componentWillReceiveProps(props) {
        console.log("got new props", props)
        if(props.value) {
            resolveValue(props.value).then((val) =>{
                this.setState({value:val})
            })
            // if(props.value.type === 'symbolref') {
            //     console.log("can resolve")
            //     resolveValue(props.value).then((val)=>{
            //         console.log("got the real value",val,this.div)
            //         this.renderResult(val)
            //     })
            // }
            // if(props.value.type === 'expression') {
            //     console.log("must resolve an expression")
            //     resolveValue(props.value).then((val)=>{
            //         console.log("got the real value",val,this.div)
            //         this.renderResult(val)
            //     })
            // }
            // if(props.value.type === 'block') {
            //     resolveValue(props.value).then((val)=>{
            //         console.log("got the real value",val,this.div)
            //         this.renderResult(val)
            //     })
            // }
        }
    }
    // renderResult(val) {
    //     while(this.div.firstChild) {
    //         this.div.removeChild(this.div.firstChild)
    //     }
    //     // console.log("rendering",val, val instanceof Element)
    //     if(val instanceof Element) {
    //         this.div.appendChild(val)
    //     }
    // }

    updatedSlider= (e) => {
        console.log("new value is",parseFloat(e.target.value))
        console.log("need to update", this.props.value)
        console.log("the input is", this.state.value)
    }
    render() {
        console.log("renderings",this.state.value)
        if(this.state.value && this.state.value.type === 'input') {
            return <input type="range" value={10} min={0} max={20} onChange={this.updatedSlider}/>
        }
        return <div>nothing</div>
    }
}

export default App;

// function doTest() {
//     const graph = new Graph()
//     console.log('before',graph.getObjectCount())
//     const code = `'blue'=>BLUE`
//     console.log("code is",code)
//     const sem = makeToGraphSemantics(graph,grammar)
//     const match = grammar.match(code)
//     const ret = sem(match).toGraph()
//     console.log('return value is', ret)
//     console.log('after',graph.getObjectCount())
//     const objs = new Set()
//     collectObjects(ret, objs)
//     console.log("collected",objs)
// }

// function collectObjects(root, objs) {
//     console.log("type = ", root.type)
//     if(root.type === 'block') {
//         root.statements.forEach((n)=>collectObjects(n,objs))
//     }
//     if(root.type === 'statement') {
//         collectObjects(root.first,objs)
//         root.rest.forEach(n=>collectObjects(n,objs))
//     }
//     if(root.type === 'literal') {
//         objs.add(root)
//     }
//     if(root.type === 'symbolref') {
//         objs.add(root)
//     }
// }

// doTest()


/*
Slider(min:0, max:10) => A
A+5 => C

make a block renderer to track each text area block of code
also listens to changes on the graph
also tracks the nodes created for that block
when re-evaluating that block, remove the nodes, then evaluate the new ones.
after evaluation, draw the output of the eval, which could be a number, string, canvas, or UI control
after eval and re-render, need to tell everything else attached to the graph to re-evaluate lazily.



---
8 => A
---
9 => B
add(A,B)
---


* create graph. stored at the app level and passed into the input panel as a prop
* evaluate the first block. creates literal and symbolref nodes
* evaluate the second block. creates the literal and symbolref nodes, and expression node
* send to output panel
* resolves the value for the second block. produces the literal number 15
* render the 15 in the output panel's output
* edit the second block and evaluate.
* remove the previous literal and symbolref nodes
* add new literal and symbol ref nodes
* mark that the graph has changed
* second output panel is notified of a change. resolves the value again. should get a new value.






*/