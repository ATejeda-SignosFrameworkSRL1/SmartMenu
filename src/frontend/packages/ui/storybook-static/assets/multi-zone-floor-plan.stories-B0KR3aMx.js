import{j as e}from"./jsx-runtime-DFAAy_2V.js";import{r as M}from"./index-Bc2G9s8g.js";import{a as z,M as n}from"./multi-zone-mock-BPTMn-SQ.js";import{M as b}from"./multi-zone-floor-plan-editor-CHt4fWdC.js";import"./tabs-CqyYY11X.js";import"./index-DwmB-tLc.js";import"./index-BZgcsEBY.js";import"./index-DY2LJyxg.js";import"./index-DElvVMUg.js";import"./index-DYLXRpC5.js";import"./index-Csns8JzQ.js";import"./index-DfyG9F4w.js";import"./index-4Qn5PQE1.js";import"./index-BrGS85o1.js";import"./cn-BLSKlp9E.js";import"./floor-plan-viewer-3fC_RlDs.js";import"./floor-plan-canvas-DVYSwzBF.js";import"./ReactKonvaCore-DiLRYPAA.js";import"./table-shape-B0mLtTVu.js";import"./structure-shape-D0TNlSLl.js";import"./x-V4Vg7zWV.js";import"./createLucideIcon-DHJJE_Tl.js";const C={title:"Floor Plan/Multi-Zona",parameters:{layout:"fullscreen"}},a={render:()=>e.jsx("div",{style:{padding:12},children:e.jsx(z,{data:n,width:820,height:460})})},o={render:()=>{const f=()=>{const[x,v]=M.useState(n);return e.jsxs("div",{style:{padding:12,display:"flex",gap:16,alignItems:"flex-start",flexWrap:"wrap"},children:[e.jsx(b,{data:n,width:640,height:460,onChange:v}),e.jsx("div",{style:{fontSize:11,fontFamily:"monospace",background:"#0f172a",color:"#e2e8f0",padding:12,borderRadius:8,maxHeight:460,overflow:"auto",minWidth:260},children:x.zones.map(t=>{var s;return e.jsxs("div",{style:{marginBottom:8},children:[e.jsxs("strong",{style:{color:"#7dd3fc"},children:[t.zoneName," (",t.tables.length,")"]}),t.tables.map(r=>e.jsxs("div",{children:[r.id,": (",Math.round(r.x),", ",Math.round(r.y),")"]},r.id)),(s=t.structures)==null?void 0:s.map(r=>e.jsxs("div",{style:{color:"#fbbf24"},children:["⛬ ",r.id," [",r.type,"]: (",Math.round(r.x),", ",Math.round(r.y),")"]},r.id))]},t.zoneId)})})]})};return e.jsx(f,{})}};var i,d,l,m,p;a.parameters={...a.parameters,docs:{...(i=a.parameters)==null?void 0:i.docs,source:{originalSource:`{
  render: () => <div style={{
    padding: 12
  }}>\r
      <MultiZoneFloorPlanViewer data={MULTI_ZONE_FLOOR_PLAN} width={820} height={460} />\r
    </div>
}`,...(l=(d=a.parameters)==null?void 0:d.docs)==null?void 0:l.source},description:{story:"Host/Waiter: cambiá de zona con las pestañas; el lienzo muestra solo esa zona (read-only).",...(p=(m=a.parameters)==null?void 0:m.docs)==null?void 0:p.description}}};var c,u,h,g,y;o.parameters={...o.parameters,docs:{...(c=o.parameters)==null?void 0:c.docs,source:{originalSource:`{
  render: () => {
    const Demo = () => {
      const [data, setData] = useState<FloorPlanData>(MULTI_ZONE_FLOOR_PLAN);
      return <div style={{
        padding: 12,
        display: "flex",
        gap: 16,
        alignItems: "flex-start",
        flexWrap: "wrap"
      }}>\r
          <MultiZoneFloorPlanEditor data={MULTI_ZONE_FLOOR_PLAN} width={640} height={460} onChange={setData} />\r
          <div style={{
          fontSize: 11,
          fontFamily: "monospace",
          background: "#0f172a",
          color: "#e2e8f0",
          padding: 12,
          borderRadius: 8,
          maxHeight: 460,
          overflow: "auto",
          minWidth: 260
        }}>\r
            {data.zones.map(z => <div key={z.zoneId} style={{
            marginBottom: 8
          }}>\r
                <strong style={{
              color: "#7dd3fc"
            }}>\r
                  {z.zoneName} ({z.tables.length})\r
                </strong>\r
                {z.tables.map(t => <div key={t.id}>\r
                    {t.id}: ({Math.round(t.x)}, {Math.round(t.y)})\r
                  </div>)}\r
                {z.structures?.map(s => <div key={s.id} style={{
              color: "#fbbf24"
            }}>\r
                    ⛬ {s.id} [{s.type}]: ({Math.round(s.x)}, {Math.round(s.y)})\r
                  </div>)}\r
              </div>)}\r
          </div>\r
        </div>;
    };
    return <Demo />;
  }
}`,...(h=(u=o.parameters)==null?void 0:u.docs)==null?void 0:h.source},description:{story:`Admin: editá cada zona por separado. Arrastrá una mesa → se actualizan sus coords\r
 en la zona activa (el panel muestra el estado; los cambios persisten al cambiar de zona).`,...(y=(g=o.parameters)==null?void 0:g.docs)==null?void 0:y.description}}};const q=["Viewer","Editor"];export{o as Editor,a as Viewer,q as __namedExportsOrder,C as default};
