import{j as a}from"./jsx-runtime-DFAAy_2V.js";import{S as z,L as E}from"./ReactKonvaCore-DiLRYPAA.js";import{T as r}from"./table-shape-B0mLtTVu.js";import"./index-Bc2G9s8g.js";import"./index-DYLXRpC5.js";const G={title:"Floor Plan/TableShape",component:r,tags:["autodocs"],decorators:[L=>a.jsx(z,{width:540,height:180,children:a.jsx(E,{children:a.jsx(L,{})})})],args:{id:1,number:1,x:100,y:90,radius:30,status:"available",shape:"circle",capacity:4},argTypes:{status:{control:"select",options:["empty","available","occupied","reserved","cleaning","billing"]},shape:{control:"select",options:["circle","square","rect","diamond","banquette"]},capacity:{control:{type:"number",min:0,max:12}},isDraggable:{control:"boolean"},waiter:{control:"text"}}},s={args:{status:"available",number:1,capacity:4}},t={args:{status:"occupied",number:2,capacity:2}},c={args:{status:"reserved",number:3,capacity:6}},i={args:{status:"empty",number:"D-9",shape:"square",width:54,height:54,capacity:4}},n={args:{status:"occupied",number:"D-3",waiter:"RO",capacity:4}},o={args:{status:"available",number:4,isDraggable:!0,capacity:4}},e={render:()=>a.jsxs(a.Fragment,{children:[a.jsx(r,{id:"c",number:"C",x:70,y:90,status:"available",shape:"circle",capacity:4,waiter:"FR"}),a.jsx(r,{id:"s",number:"S",x:175,y:90,status:"occupied",shape:"square",width:54,height:54,capacity:4}),a.jsx(r,{id:"r",number:"R",x:300,y:90,status:"reserved",shape:"rect",width:76,height:48,capacity:6}),a.jsx(r,{id:"d",number:"D",x:420,y:90,status:"cleaning",shape:"diamond",width:56,height:56,capacity:4})]})};var p,u,d;s.parameters={...s.parameters,docs:{...(p=s.parameters)==null?void 0:p.docs,source:{originalSource:`{
  args: {
    status: "available",
    number: 1,
    capacity: 4
  }
}`,...(d=(u=s.parameters)==null?void 0:u.docs)==null?void 0:d.source}}};var m,l,b;t.parameters={...t.parameters,docs:{...(m=t.parameters)==null?void 0:m.docs,source:{originalSource:`{
  args: {
    status: "occupied",
    number: 2,
    capacity: 2
  }
}`,...(b=(l=t.parameters)==null?void 0:l.docs)==null?void 0:b.source}}};var h,g,y;c.parameters={...c.parameters,docs:{...(h=c.parameters)==null?void 0:h.docs,source:{originalSource:`{
  args: {
    status: "reserved",
    number: 3,
    capacity: 6
  }
}`,...(y=(g=c.parameters)==null?void 0:g.docs)==null?void 0:y.source}}};var x,v,S;i.parameters={...i.parameters,docs:{...(x=i.parameters)==null?void 0:x.docs,source:{originalSource:`{
  args: {
    status: "empty",
    number: "D-9",
    shape: "square",
    width: 54,
    height: 54,
    capacity: 4
  }
}`,...(S=(v=i.parameters)==null?void 0:v.docs)==null?void 0:S.source}}};var w,j,D;n.parameters={...n.parameters,docs:{...(w=n.parameters)==null?void 0:w.docs,source:{originalSource:`{
  args: {
    status: "occupied",
    number: "D-3",
    waiter: "RO",
    capacity: 4
  }
}`,...(D=(j=n.parameters)==null?void 0:j.docs)==null?void 0:D.source}}};var R,T,q;o.parameters={...o.parameters,docs:{...(R=o.parameters)==null?void 0:R.docs,source:{originalSource:`{
  args: {
    status: "available",
    number: 4,
    isDraggable: true,
    capacity: 4
  }
}`,...(q=(T=o.parameters)==null?void 0:T.docs)==null?void 0:q.source}}};var F,f,O,A,C;e.parameters={...e.parameters,docs:{...(F=e.parameters)==null?void 0:F.docs,source:{originalSource:`{
  render: () => <>\r
      <TableShape id="c" number="C" x={70} y={90} status="available" shape="circle" capacity={4} waiter="FR" />\r
      <TableShape id="s" number="S" x={175} y={90} status="occupied" shape="square" width={54} height={54} capacity={4} />\r
      <TableShape id="r" number="R" x={300} y={90} status="reserved" shape="rect" width={76} height={48} capacity={6} />\r
      <TableShape id="d" number="D" x={420} y={90} status="cleaning" shape="diamond" width={56} height={56} capacity={4} />\r
    </>
}`,...(O=(f=e.parameters)==null?void 0:f.docs)==null?void 0:O.source},description:{story:"Todas las formas con sus sillas (capacity) y un badge de mozo.",...(C=(A=e.parameters)==null?void 0:A.docs)==null?void 0:C.description}}};const H=["Available","Occupied","Reserved","Libre","ConMozo","Arrastrable","Formas"];export{o as Arrastrable,s as Available,n as ConMozo,e as Formas,i as Libre,t as Occupied,c as Reserved,H as __namedExportsOrder,G as default};
