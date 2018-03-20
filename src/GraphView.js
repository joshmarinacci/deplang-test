import React, {Component} from "react"

export default class GraphView extends Component {
    render() {
        if(this.props.graph) {
            return <ul className="panel">{Object.keys(this.props.graph.objs).map((id)=>{
                const obj = this.props.graph.objs[id]
                return <li key={id}>{this.renderObj(obj)}</li>
            })}</ul>
        } else {
            return <div className="panel">no graph view</div>
        }
    }

    renderObj(obj) {
        if(obj.type === 'literal') {
            return <div><b>literal</b> {obj.name} is {obj.value}</div>
        }
        if(obj.type === 'symbolref') {
            return <div><b>symbol ref</b> {obj.name}</div>
        }
        if(obj.type === 'expression') {
            const outp = Object.keys(obj.inputs).map((key) => {
                const val = obj.inputs[key]
                let str = val.toString()
                if (val.type === 'literal') str = val.value
                if (val.type === 'symbolref') str = '@' + val.name
                if (val.type === 'expression') str = '$' + val.name
                return key + " : " + str
            })
            return <div><b>Expression</b> {obj.name} ({outp.join(", ")})</div>
        }
        return <div>unknown object type {obj.type}</div>
    }
}