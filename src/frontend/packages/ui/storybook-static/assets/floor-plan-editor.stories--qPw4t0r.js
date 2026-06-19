import{j as e}from"./jsx-runtime-DFAAy_2V.js";import{r as g}from"./index-Bc2G9s8g.js";import{F as d}from"./floor-plan-editor-CDHJ93V_.js";import{M as n}from"./mock-tables-CQbxvHlh.js";import"./floor-plan-canvas-DVYSwzBF.js";import"./ReactKonvaCore-DiLRYPAA.js";import"./index-DYLXRpC5.js";import"./table-shape-B0mLtTVu.js";import"./structure-shape-D0TNlSLl.js";const j={title:"Floor Plan/FloorPlanEditor",component:d,tags:["autodocs"],parameters:{layout:"fullscreen"}},r={render:()=>{const l=()=>{const[p,m]=g.useState(n);return e.jsxs("div",{style:{display:"flex",gap:16,alignItems:"flex-start",padding:12,flexWrap:"wrap"},children:[e.jsx(d,{initialTables:n,width:560,height:400,onChange:m}),e.jsx("pre",{style:{fontSize:12,background:"#0f172a",color:"#e2e8f0",padding:12,borderRadius:8,maxHeight:400,overflow:"auto",margin:0},children:JSON.stringify(p.map(({id:u,x:c,y:f})=>({id:u,x:Math.round(c),y:Math.round(f)})),null,2)})]})};return e.jsx(l,{})}};var o,t,a,s,i;r.parameters={...r.parameters,docs:{...(o=r.parameters)==null?void 0:o.docs,source:{originalSource:`{
  render: () => {
    const Demo = () => {
      const [coords, setCoords] = useState<TableData[]>(MOCK_TABLES);
      return <div style={{
        display: "flex",
        gap: 16,
        alignItems: "flex-start",
        padding: 12,
        flexWrap: "wrap"
      }}>\r
          <FloorPlanEditor initialTables={MOCK_TABLES} width={560} height={400} onChange={setCoords} />\r
          <pre style={{
          fontSize: 12,
          background: "#0f172a",
          color: "#e2e8f0",
          padding: 12,
          borderRadius: 8,
          maxHeight: 400,
          overflow: "auto",
          margin: 0
        }}>\r
            {JSON.stringify(coords.map(({
            id,
            x,
            y
          }) => ({
            id,
            x: Math.round(x),
            y: Math.round(y)
          })), null, 2)}\r
          </pre>\r
        </div>;
    };
    return <Demo />;
  }
}`,...(a=(t=r.parameters)==null?void 0:t.docs)==null?void 0:a.source},description:{story:`Editor interactivo: arrastrá una mesa y soltá. El panel de la derecha muestra\r
las coordenadas en vivo (simula el estado que luego se persistiría en SQL).`,...(i=(s=r.parameters)==null?void 0:s.docs)==null?void 0:i.description}}};const w=["Default"];export{r as Default,w as __namedExportsOrder,j as default};
