import { K8s, registerRoute, registerSidebarEntry } from '@kinvolk/headlamp-plugin/lib';
import { SectionBox, StatusLabel, Table } from '@kinvolk/headlamp-plugin/lib/components/common';
import { Alert, Box, Chip, FormControl, MenuItem, Select, Typography } from '@mui/material';
import { makeCustomResourceClass } from '@kinvolk/headlamp-plugin/lib/lib/k8s/crd';
import { useEffect, useState } from 'react';

const PublicEdge = makeCustomResourceClass({apiInfo:[{group:'networking.re8ch.com',version:'v1alpha1'}],kind:'PublicEdge',pluralName:'publicedges',singularName:'publicedge',isNamespaced:false});
const HTTPRoute = K8s.ResourceClasses.HTTPRoute;

function condition(item:any, type:string) {
  return item.status?.conditions?.find((x:any)=>x.type===type)?.status === 'True';
}

function PublicEdgeMark({size=64}:{size?:number}) {
  return <Box component="svg" viewBox="0 0 120 120" aria-label="Public Edge" sx={{width:size,height:size,flex:'0 0 auto'}}>
    <path d="M72 18a44 44 0 1 0 0 84" fill="none" stroke="#123c91" strokeWidth="11" strokeLinecap="round"/>
    <path d="M48 49 60 42l12 7v14l-12 7-12-7Z" fill="#123c91"/>
    <path d="m68 49 15-15M71 56h22M68 64l15 15" fill="none" stroke="#123c91" strokeWidth="7"/>
    <circle cx="88" cy="29" r="10" fill="#139cff"/><circle cx="100" cy="56" r="10" fill="#139cff"/><circle cx="88" cy="84" r="10" fill="#00df83"/>
  </Box>;
}

function Fact({label,value,tone='default'}:{label:string;value:any;tone?:'default'|'good'|'bad'}) {
  return <Box sx={{minWidth:0}}><Typography variant="caption" color="text.secondary">{label}</Typography><Typography sx={{fontFamily:'monospace',fontSize:13,color:tone==='good'?'success.main':tone==='bad'?'error.main':'text.primary',overflowWrap:'anywhere'}}>{value || '-'}</Typography></Box>;
}

function FlowNode({label,value,state='neutral'}:{label:string;value:string;state?:'neutral'|'good'|'bad'}) {
  const color=state==='good'?'#00a866':state==='bad'?'#d32f2f':'#139cff';
  return <Box sx={{position:'relative',minWidth:150,flex:'1 1 150px',p:1.5,border:'1px solid',borderColor:'divider',borderRadius:2,bgcolor:'background.paper',boxShadow:'0 8px 24px rgba(18,60,145,.08)'}}>
    <Box sx={{width:9,height:9,borderRadius:'50%',bgcolor:color,mb:1}}/><Typography variant="caption" color="text.secondary">{label}</Typography><Typography sx={{fontWeight:700,fontSize:13,overflowWrap:'anywhere'}}>{value || '-'}</Typography>
  </Box>;
}

function Dashboard() {
  const [selectedHost, setSelectedHost] = useState('');
  const [edges, edgeError] = PublicEdge.useList({} as any);
  const [routes, routeError] = HTTPRoute.useList({} as any);
  const [pods] = K8s.ResourceClasses.Pod.useList({} as any);
  const [slices] = K8s.ResourceClasses.EndpointSlice.useList({} as any);
  const [ingresses] = K8s.ResourceClasses.Ingress.useList({} as any);
  const [services] = K8s.ResourceClasses.Service.useList({} as any);
  const publicRoutes = (routes || []).filter((x:any)=>x.spec?.hostnames?.length);
  const podByIp = new Map((pods || []).filter((x:any)=>x.status?.podIP).map((x:any)=>[x.status.podIP,x]));

  const routeRows = publicRoutes.flatMap((route:any)=>(route.spec.hostnames || []).map((host:string)=>{
    const authority=(ingresses || []).find((x:any)=>x.metadata?.annotations?.['external-dns.alpha.kubernetes.io/hostname']?.split(',').includes(host));
    const refs=(route.spec.rules || []).flatMap((r:any)=>r.backendRefs || []);
    const backends=refs.map((b:any)=>`${route.metadata.namespace}/${b.name}:${b.port}`).join(', ');
    const backendNames=new Set(refs.map((b:any)=>b.name));
    const endpointIPs=(slices || []).filter((s:any)=>s.metadata?.namespace===route.metadata.namespace && backendNames.has(s.metadata?.labels?.['kubernetes.io/service-name'])).flatMap((s:any)=>(s.endpoints || []).filter((e:any)=>e.conditions?.ready!==false).flatMap((e:any)=>e.addresses || []));
    const nodes=[...new Set(endpointIPs.map((ip:string)=>podByIp.get(ip)?.spec?.nodeName).filter(Boolean))].join(', ') || '-';
    const parents=(route.spec.parentRefs || []).map((p:any)=>`${p.namespace || route.metadata.namespace}/${p.name}#${p.sectionName || '*'}`).join(' → ');
    const service=(services || []).find((item:any)=>item.metadata?.namespace===route.metadata.namespace && backendNames.has(item.metadata?.name));
    const accepted=(route.status?.parents || []).length>0 && (route.status?.parents || []).every((p:any)=>(p.conditions || []).some((c:any)=>c.type==='Accepted'&&c.status==='True'));
    const resolved=(route.status?.parents || []).length>0 && (route.status?.parents || []).every((p:any)=>(p.conditions || []).some((c:any)=>c.type==='ResolvedRefs'&&c.status==='True'));
    return {host,namespace:route.metadata.namespace,routeName:route.metadata.name,edge:authority?.metadata?.annotations?.['networking.re8ch.com/selected-public-edge'] || '-',target:authority?.metadata?.annotations?.['external-dns.alpha.kubernetes.io/target'] || '-',parents,backends,nodes,endpointIPs,serviceIP:service?.spec?.clusterIP || '-',servicePorts:(service?.spec?.ports || []).map((p:any)=>`${p.port}/${p.protocol || 'TCP'}`).join(', ') || '-',accepted,resolved};
  }));

  useEffect(()=>{
    if (!selectedHost && routeRows.length) setSelectedHost(routeRows[0].host);
    if (selectedHost && !routeRows.some((row:any)=>row.host===selectedHost)) setSelectedHost(routeRows[0]?.host || '');
  },[selectedHost,routeRows.map((row:any)=>row.host).join('|')]);
  const selected:any=routeRows.find((row:any)=>row.host===selectedHost);

  return <Box sx={{p:2,maxWidth:1600,mx:'auto'}}>
    <Box sx={{display:'flex',alignItems:'center',gap:2,p:2.5,borderRadius:3,background:'linear-gradient(135deg, rgba(18,60,145,.12), rgba(19,156,255,.05) 65%, rgba(0,223,131,.10))',border:'1px solid rgba(18,60,145,.16)'}}>
      <PublicEdgeMark size={76}/><Box><Typography variant="h4" sx={{fontWeight:800,color:'#123c91'}}>Public Edge</Typography><Typography color="text.secondary">从外部 Endpoint 进入集群，查看 DNS authority、Gateway、Service、EndpointSlice 与 Pod 的查询和回应。</Typography></Box>
    </Box>
    {(edgeError || routeError) && <Alert severity="error">无法读取 PublicEdge/Gateway API：{String(edgeError || routeError)}</Alert>}
    <SectionBox title="External endpoint query">
      {routeRows.length ? <>
        <FormControl size="small" sx={{minWidth:320,maxWidth:'100%',mb:2}}><Select value={selectedHost} onChange={event=>setSelectedHost(event.target.value)} aria-label="External endpoint">
          {routeRows.map((row:any)=><MenuItem key={`${row.namespace}/${row.routeName}/${row.host}`} value={row.host}>{row.host}</MenuItem>)}
        </Select></FormControl>
        {selected && <>
          <Box sx={{display:'flex',alignItems:'stretch',gap:1,flexWrap:'wrap'}}>
            <FlowNode label="External request" value={`https://${selected.host}/`}/>
            <FlowNode label="DNS / PublicEdge" value={`${selected.edge} · ${selected.target}`} state={selected.target==='-'?'bad':'good'}/>
            <FlowNode label="Gateway listener" value={selected.parents} state={selected.accepted?'good':'bad'}/>
            <FlowNode label="ClusterIP Service" value={`${selected.backends} · ${selected.serviceIP}`} state={selected.resolved?'good':'bad'}/>
            <FlowNode label="Ready endpoints" value={`${selected.endpointIPs.length} · ${selected.nodes}`} state={selected.endpointIPs.length?'good':'bad'}/>
          </Box>
          <Box sx={{display:'grid',gridTemplateColumns:{xs:'1fr',md:'1fr 1fr'},gap:2,mt:2}}>
            <Box sx={{p:2,borderRadius:2,bgcolor:'rgba(18,60,145,.06)',border:'1px solid rgba(18,60,145,.14)'}}><Typography variant="subtitle2" sx={{mb:1,color:'#123c91'}}>集群内部查询</Typography><Box sx={{display:'grid',gridTemplateColumns:'repeat(2,minmax(0,1fr))',gap:1.5}}><Fact label="HTTPRoute" value={`${selected.namespace}/${selected.routeName}`}/><Fact label="Host" value={selected.host}/><Fact label="Service ports" value={selected.servicePorts}/><Fact label="Endpoint IPs" value={selected.endpointIPs.join(', ') || '-'}/></Box></Box>
            <Box sx={{p:2,borderRadius:2,bgcolor:selected.accepted&&selected.resolved&&selected.endpointIPs.length?'rgba(0,223,131,.08)':'rgba(211,47,47,.06)',border:'1px solid',borderColor:selected.accepted&&selected.resolved&&selected.endpointIPs.length?'rgba(0,168,102,.25)':'rgba(211,47,47,.2)'}}><Typography variant="subtitle2" sx={{mb:1}}>集群控制面回应</Typography><Box sx={{display:'grid',gridTemplateColumns:'repeat(2,minmax(0,1fr))',gap:1.5}}><Fact label="Route Accepted" value={selected.accepted?'True':'False'} tone={selected.accepted?'good':'bad'}/><Fact label="References Resolved" value={selected.resolved?'True':'False'} tone={selected.resolved?'good':'bad'}/><Fact label="Ready endpoints" value={selected.endpointIPs.length} tone={selected.endpointIPs.length?'good':'bad'}/><Fact label="Backend nodes" value={selected.nodes} tone={selected.endpointIPs.length?'good':'bad'}/></Box></Box>
          </Box>
          <Alert severity="info" sx={{mt:2}}>这里显示 Kubernetes/Gateway API 的实时控制面回应，不等同于一次真实外部 HTTP 请求的状态码或耗时；后者需要接入探针或请求遥测。</Alert>
        </>}
      </> : <Alert severity="warning">当前没有声明 hostname 的 HTTPRoute，暂无可查询的外部 Endpoint。</Alert>}
    </SectionBox>
    <SectionBox title={`Candidates (${(edges || []).length})`}>
      <Table data={edges || []} columns={[
        {header:'Candidate',accessorFn:(x:any)=>x?.metadata?.name || '-'},
        {header:'Area / Region',accessorFn:(x:any)=>`${x?.spec?.area || '-'} / ${x?.spec?.region || '-'}`},
        {header:'Node',accessorFn:(x:any)=>x?.spec?.nodeName || '-'},
        {header:'Public endpoint',accessorFn:(x:any)=>x?.spec?.endpoint?.value || '-'},
        {header:'Gateway VIP',accessorFn:(x:any)=>x?.spec?.gatewayVIP || '-'},
        {header:'Capacity',accessorFn:(x:any)=>x?.spec?.capacityMbps == null ? '-' : `${x.spec.capacityMbps} Mbps`},
        {header:'State',accessorFn:(x:any)=><StatusLabel status={condition(x,'Ready')?'success':'error'}>{x?.spec?.draining?'Draining':condition(x,'Ready')?'Ready':'Unavailable'}</StatusLabel>},
        {header:'Classes',accessorFn:(x:any)=><Box sx={{display:'flex',gap:.5,flexWrap:'wrap'}}>{(Array.isArray(x?.spec?.serviceClasses) ? x.spec.serviceClasses : []).map((v:string)=><Chip key={v} size="small" label={v}/>)}</Box>}
      ] as any}/>
    </SectionBox>
    <SectionBox title={`Published services (${routeRows.length})`}>
      <Table data={routeRows} columns={[
        {header:'Hostname',accessorKey:'host'},
        {header:'Selected exit',accessorFn:(x:any)=>`${x.edge} (${x.target})`},
        {header:'Gateway path',accessorKey:'parents'},
        {header:'Backend service',accessorKey:'backends'},
        {header:'Actual Pod nodes',accessorKey:'nodes'},
        {header:'Route',accessorFn:(x:any)=><StatusLabel status={x.accepted?'success':'error'}>{x.accepted?'Accepted':'Problem'}</StatusLabel>}
      ] as any}/>
    </SectionBox>
    <Typography variant="caption" color="text.secondary">Resolved Pod 节点由 EndpointSlice/Pod 实时状态补充；当前发现 {podByIp.size} 个可寻址 Pod。</Typography>
  </Box>;
}

registerSidebarEntry({name:'public-edge',url:'/public-edge',icon:'mdi:wan',parent:'',label:'Public Edge'});
registerRoute({path:'/public-edge',sidebar:'public-edge',name:'Public Edge',component:()=> <Dashboard/>});
