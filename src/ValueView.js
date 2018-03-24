import React, {Component} from "react"

export default class ValueView extends Component {
    render() {
        if(this.props.value) {
            return <div className="panel">
                {this.renderGraphComponents(this.props.graph)}
                {this.renderValue(this.props.value)}
                </div>
        } else {
            return <div className="panel">no value </div>
        }
    }

    renderValue(value) {
        if(value.type === 'literal') {
            return <span>{value.value}</span>
        }
    }

    renderGraphComponents(graph) {
        if (!graph) return ""
        const uis = Object.keys(graph.objs).map((id) => {
            const node = graph.objs[id]
            if(!node.ui) return
            if(node.ui.type === 'slider') {
                return <div key={id}>
                    <input type="range" value={node.ui.value}
                           onChange={(e)=>{
                               const val  = parseFloat(e.target.value)
                               node.storage['value'] = val
                               graph.markNodeDirty(node)
                           }}
                    />
                    <label>{node.ui.value}</label>
                </div>
            }
        })
        return <div>uis {uis}</div>
    }
}