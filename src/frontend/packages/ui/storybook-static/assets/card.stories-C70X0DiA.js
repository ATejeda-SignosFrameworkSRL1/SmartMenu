import{j as e}from"./jsx-runtime-DFAAy_2V.js";import{r as d}from"./index-Bc2G9s8g.js";import{c as t}from"./cn-BLSKlp9E.js";import{B as C}from"./button-RUUrGF7S.js";import{B as u}from"./badge-t8QdeU8V.js";import"./index-ses-1Ffn.js";import"./index-BZgcsEBY.js";import"./index-EXTQMK5R.js";const n=d.forwardRef(({className:r,...a},s)=>e.jsx("div",{ref:s,className:t("rounded-lg border bg-card text-card-foreground shadow-sm",r),...a}));n.displayName="Card";const i=d.forwardRef(({className:r,...a},s)=>e.jsx("div",{ref:s,className:t("flex flex-col space-y-1.5 p-6",r),...a}));i.displayName="CardHeader";const c=d.forwardRef(({className:r,...a},s)=>e.jsx("h3",{ref:s,className:t("text-2xl font-semibold leading-none tracking-tight",r),...a}));c.displayName="CardTitle";const m=d.forwardRef(({className:r,...a},s)=>e.jsx("p",{ref:s,className:t("text-sm text-muted-foreground",r),...a}));m.displayName="CardDescription";const l=d.forwardRef(({className:r,...a},s)=>e.jsx("div",{ref:s,className:t("p-6 pt-0",r),...a}));l.displayName="CardContent";const p=d.forwardRef(({className:r,...a},s)=>e.jsx("div",{ref:s,className:t("flex items-center p-6 pt-0",r),...a}));p.displayName="CardFooter";n.__docgenInfo={description:"",methods:[],displayName:"Card"};i.__docgenInfo={description:"",methods:[],displayName:"CardHeader"};p.__docgenInfo={description:"",methods:[],displayName:"CardFooter"};c.__docgenInfo={description:"",methods:[],displayName:"CardTitle"};m.__docgenInfo={description:"",methods:[],displayName:"CardDescription"};l.__docgenInfo={description:"",methods:[],displayName:"CardContent"};const F={title:"Primitivos/Card",component:n,tags:["autodocs"]},o={render:()=>e.jsxs(n,{className:"w-80",children:[e.jsxs(i,{children:[e.jsx(c,{children:"Mesa 12"}),e.jsx(m,{children:"Salón Principal · 4 personas"})]}),e.jsxs(l,{className:"flex items-center gap-2 text-sm",children:[e.jsx(u,{children:"Ocupada"}),e.jsx("span",{className:"text-muted-foreground",children:"Orden #7CFDFA"})]}),e.jsxs(p,{className:"gap-2",children:[e.jsx(C,{size:"sm",children:"Ver orden"}),e.jsx(C,{size:"sm",variant:"outline",children:"Cobrar"})]})]})};var f,x,N;o.parameters={...o.parameters,docs:{...(f=o.parameters)==null?void 0:f.docs,source:{originalSource:`{
  render: () => <Card className="w-80">\r
      <CardHeader>\r
        <CardTitle>Mesa 12</CardTitle>\r
        <CardDescription>Salón Principal · 4 personas</CardDescription>\r
      </CardHeader>\r
      <CardContent className="flex items-center gap-2 text-sm">\r
        <Badge>Ocupada</Badge>\r
        <span className="text-muted-foreground">Orden #7CFDFA</span>\r
      </CardContent>\r
      <CardFooter className="gap-2">\r
        <Button size="sm">Ver orden</Button>\r
        <Button size="sm" variant="outline">Cobrar</Button>\r
      </CardFooter>\r
    </Card>
}`,...(N=(x=o.parameters)==null?void 0:x.docs)==null?void 0:N.source}}};const v=["Default"];export{o as Default,v as __namedExportsOrder,F as default};
