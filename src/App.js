import React, { Component } from 'react';
import ohm  from 'ohm-js'
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
}


class Graph {
    constructor() {
        this.objs = {}
        this.SYMBOLS = {}
    }
    makeInteractive(name,value) { return this.makeLiteral(name,value)  }
    genID(prefix) { return prefix + Math.floor(Math.random() * 10000) }

    makeObj(obj) {
        obj.id = this.genID(obj.type)
        obj.inputs = {}
        obj.graph = this
        this.objs[obj.id] = obj
        return obj
    }
    makeLiteral(name,value) {   return this.makeObj({ name:name, type:'literal',   value:value, }) }
    makeSymbolReference(name) { return this.makeObj({ name:name, type:'symbolref', value:name   }) }
    makeExpression(name) {      return this.makeObj({ name:name, type:'expression'              }) }
    makeAssignment(name) {      return this.makeObj({ name:name, type:'assignment'              }) }

    add(src,dst,name) { dst.inputs[name] = src  }
    setFunction(obj,fun) {  obj.fun = fun }
    setValue(obj,value) { obj.value = value  }
    findByName(name) {  return Object.values(this.objs).find((obj)=>obj.name === name)  }

    dump() {
        console.log("=== object graph dump ===")
        Object.keys(this.objs).forEach((id)=>{
            const obj = this.objs[id]
            if(obj.type === 'literal')
                return console.log(`Literal:: ${obj.name} is ${obj.value}`)
            if(obj.type === 'symbolref') {
                return console.log(`Symbol ref::${obj.name}`)
            }
            const outp = Object.keys(obj.inputs).map((key)=>{
                const val = obj.inputs[key]
                let str = val.toString()
                if(val.type === 'literal') str = val.value
                if(val.type === 'symbolref') str = '@' + val.name
                if(val.type === 'expression') str = '$' + val.name
                return key + " : " + str
            })
            console.log(`Object:: ${obj.name} (${outp.join(", ")})`)
        })
        console.log("=== ===")
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
            const rest_n = rest.toGraph()
            rest_n.reduce((first,next)=>{
                if(next.type === 'symbolref') graph.SYMBOLS[next.name] = first
                if(next.type === 'expression') graph.add(first,next,'input')
                return next
            },first.toGraph())
            if(rest_n.length > 0) {
                console.log("returning", rest_n[rest_n.length-1])
                return rest_n[rest_n.length-1]
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
    return new Promise((res,rej)=>{
        //it must be an expression
        const proms = Object.keys(node.inputs).map((key)=> resolveValue(node.inputs[key]))
        return Promise.all(proms).then((rets)=>{
            const args = {}
            Object.keys(node.inputs).forEach((key,i)=> args[key] = rets[i])//resolveValue(node.inputs[key]))
            const fun = PREDEFINED_FUNCTIONS[node.name]
            if(fun) res(fun(null, args))
            rej(new Error("no defined function",node.name))
        })
    })
}

const src = `
    'blue' => BLUE
    Circle ( cx:25, cy:50, radius:20, fill:BLUE ) => circle1
    Circle ( cx:75, cy:50, radius:20, fill:'green' ) => circle2
    Image ( width: 100, height: 100 ) 
        => Draw ( shapes:circle1 ) 
        => Draw ( shapes:circle2 ) 
`

class App extends Component {
    constructor(props) {
        super(props)
        this.state = {
            source:src,
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
        console.log("got the output",last)
        this.setState({
            graph:graph,
            value:last
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
        console.log("rendering")
        return (
            <div id="main">
                <textarea value={this.state.source} onChange={this.edited}
                          rows={10} cols={80}
                          onKeyDown={this.keypressed}
                />
                <button onClick={this.evaluate}>evaluate</button>
                <OutputPanel graph={this.state.graph} value={this.state.value}/>
            </div>
        );
    }
}

class OutputPanel extends Component {
    constructor(props) {
        super(props)
    }
    componentWillMount() {
        console.log("mounting")
    }
    componentWillUnmount() {
        console.log("unmounting")
    }
    shouldComponentUpdate() {
        return false
    }
    componentWillReceiveProps(props) {
        console.log("got new props", props)
        if(props.value) {
            if(props.value.type === 'symbolref') {
                console.log("can resolve")
                resolveValue(props.value).then((val)=>{
                    console.log("got the real value",val,this.div)
                    this.renderResult(val)
                })
            }
            if(props.value.type === 'expression') {
                console.log("must resolve an expression")
                resolveValue(props.value).then((val)=>{
                    console.log("got the real value",val,this.div)
                    this.renderResult(val)
                })
            }
        }
    }
    renderResult(val) {
        while(this.div.firstChild) {
            this.div.removeChild(this.div.firstChild)
        }
        console.log("rendering",val, val instanceof Element)
        if(val instanceof Element) {
            this.div.appendChild(val)
        }
    }
    render() {
        return <div ref={(div)=>this.div = div}></div>
    }
}

export default App;

