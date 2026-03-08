import { useState, useEffect, useRef, useCallback } from "react";

// ══════════════════════════════════════════════════════════════════════
//  VELSA — Dual Fault Simulator  v3.0
//
//  WP#17 기반 장애 2종류:
//
//  [1] LINK FAULT — 광링크(리본케이블/코어) 물리 손실
//      • 노드 자체는 살아있음
//      • 해당 링크만 단절
//      • VELSA 대응:
//          - HC 링크: Q-axis reroute → 황금 점선
//          - 수직/mesh: core substitution → 핑크 ⇄
//
//  [2] NODE DOWN — 장비 전원/하드웨어 완전 다운
//      • 노드 자체 사망
//      • 연결된 모든 링크 동시 단절
//      • T4: 비중요 (rhizome detach)
//      • H6+: Path Terminated → 상위 Degraded 전파
//      • VELSA 대응: 새 E2E 경로 재탐색
//
//  주소 체계:
//  T4: T4-KR01-R[n]-[seq]  H6: H6-Q7-KR01-[3bit]
//  O8: O8-Q6-KR01-[3bit]   D12: D12-Q5-KR01-[2bit]
//  I20: I20-Q4-KR01-01
// ══════════════════════════════════════════════════════════════════════

const REGION = "KR01";

const C = {
  T4:   '#00E5FF',
  H6:   '#9E9E9E',
  O8:   '#2979FF',
  D12:  '#00C853',
  I20:  '#AA00FF',
  NODE_DOWN:  '#FF1744',
  LINK_FAULT: '#FF6D00',
  CORE_SWAP:  '#F48FB1',
  Q_REROUTE:  '#FFD740',
  E2E:        '#E040FB',
  DEGRADED:   '#FF9800',
};

const LAYERS = [
  { id:0, key:'T4',  color:C.T4,  ai:null,   hcDim:0 },
  { id:1, key:'H6',  color:C.H6,  ai:null,   hcDim:3 },
  { id:2, key:'O8',  color:C.O8,  ai:'PAI',  hcDim:3 },
  { id:3, key:'D12', color:C.D12, ai:'AAI',  hcDim:2 },
  { id:4, key:'I20', color:C.I20, ai:'AsAI', hcDim:0 },
];

const H6_N=8, O8_N=8, D12_N=4;
const W=1100, H=640;
const LY  = [555, 440, 320, 195, 78];
const LXR = [[55,1045],[75,1025],[110,990],[270,830],[480,620]];
const BR  = [8,12,15,18,24];

function mkRng(s){ let r=s; return()=>{ r=(r*1664525+1013904223)&0xffffffff; return(r>>>0)/0xffffffff; }; }
const h6n  = i => `H6-Q7-${REGION}-${i.toString(2).padStart(3,'0')}`;
const o8n  = i => `O8-Q6-${REGION}-${i.toString(2).padStart(3,'0')}`;
const d12n = i => `D12-Q5-${REGION}-${i.toString(2).padStart(2,'0')}`;
const t4n  = (c,s) => `T4-${REGION}-R${c+1}-${String(s+1).padStart(3,'0')}`;

function buildNodes(seed) {
  const r = mkRng(seed); const nodes = [];
  for (let i=0;i<H6_N;i++) {
    const t=i/(H6_N-1); const[xL,xR]=LXR[1];
    nodes.push({ id:`1-${i}`, layer:1, index:i, name:h6n(i),
      proxCoord:i.toString(2).padStart(3,'0'),
      x:xL+t*(xR-xL)+(r()-.5)*18, y:LY[1]+(r()-.5)*22,
      state:'idle', nodeDown:false, phase:r()*Math.PI*2, e2eKnown:[] });
  }
  nodes.filter(n=>n.layer===1).forEach((h6,ci)=>{
    const cnt=2+Math.floor(r()*2);
    for(let j=0;j<cnt;j++)
      nodes.push({ id:`0-${ci}-${j}`, layer:0, index:j, name:t4n(ci,j),
        cluster:ci, parentH6:h6.id, proxCoord:null,
        x:h6.x+(j-(cnt-1)/2)*40+(r()-.5)*10, y:LY[0]+(r()-.5)*30,
        state:'idle', nodeDown:false, phase:r()*Math.PI*2 });
  });
  for(let i=0;i<O8_N;i++) {
    const t=i/(O8_N-1); const[xL,xR]=LXR[2];
    nodes.push({ id:`2-${i}`, layer:2, index:i, name:o8n(i),
      proxCoord:i.toString(2).padStart(3,'0'),
      x:xL+t*(xR-xL)+(r()-.5)*16, y:LY[2]+(r()-.5)*16,
      state:'idle', nodeDown:false, phase:r()*Math.PI*2, e2eKnown:[] });
  }
  for(let i=0;i<D12_N;i++) {
    const t=i/(D12_N-1); const[xL,xR]=LXR[3];
    nodes.push({ id:`3-${i}`, layer:3, index:i, name:d12n(i),
      proxCoord:i.toString(2).padStart(2,'0'),
      x:xL+t*(xR-xL)+(r()-.5)*12, y:LY[3]+(r()-.5)*12,
      state:'idle', nodeDown:false, phase:r()*Math.PI*2 });
  }
  nodes.push({ id:'4-0', layer:4, index:0, name:`I20-Q4-${REGION}-01`,
    proxCoord:'01', x:(LXR[4][0]+LXR[4][1])/2, y:LY[4],
    state:'idle', nodeDown:false, phase:0 });
  return nodes;
}

function buildLinks(nodes, lfRate, seed) {
  const r = mkRng(seed+7777); const links=[]; let lid=0;
  const push=(from,to,kind,layer,meta={})=>{
    links.push({ id:`L${lid++}`, from, to, kind, layer,
      linkFault: r()<lfRate?'cut':false,
      active:false, reroute:false, coreSwap:false, ...meta });
  };
  const by = l=>nodes.filter(n=>n.layer===l);
  by(0).forEach(t4=>push(t4.id,t4.parentH6,'rhizome-up',0,{e2eHop:true}));
  by(1).forEach((a,ai)=>by(1).forEach((b,bi)=>{
    if(bi<=ai)return; const x=a.index^b.index;
    if(x>0&&(x&(x-1))===0) push(a.id,b.id,'h6-mesh',1);
  }));
  by(1).forEach((h6,hi)=>{
    const o8s=by(2); const ti=Math.round((hi/(H6_N-1))*(O8_N-1));
    push(h6.id,o8s[ti].id,'vertical',1,{e2eHop:true});
    const ti2=Math.min(ti+1,O8_N-1);
    if(ti2!==ti) push(h6.id,o8s[ti2].id,'vertical',1,{e2eHop:true});
  });
  by(2).forEach((a,ai)=>by(2).forEach((b,bi)=>{
    if(bi<=ai)return; const x=a.index^b.index;
    if(x>0&&(x&(x-1))===0&&x<8) push(a.id,b.id,'hypercube',2);
  }));
  by(2).forEach((o8,oi)=>{
    const d12s=by(3); const ti=Math.round((oi/(O8_N-1))*(D12_N-1));
    push(o8.id,d12s[ti].id,'vertical',2);
    const ti2=Math.min(ti+1,D12_N-1);
    if(ti2!==ti) push(o8.id,d12s[ti2].id,'vertical',2);
  });
  by(3).forEach((a,ai)=>by(3).forEach((b,bi)=>{
    if(bi<=ai)return; const x=a.index^b.index;
    if(x>0&&(x&(x-1))===0) push(a.id,b.id,'hypercube',3);
  }));
  by(3).forEach(d=>push(d.id,'4-0','vertical',3));
  return links;
}

function velsaStep(nodes, links) {
  const nm={}; nodes.forEach(n=>{nm[n.id]={...n};});
  const lks=links.map(l=>({...l,active:false,reroute:false,coreSwap:false}));
  const logs=[];
  const alive=id=>nm[id]&&!nm[id].nodeDown;
  const active=id=>alive(id)&&nm[id].state!=='idle';

  // ① NODE DOWN 처리
  nodes.filter(n=>n.nodeDown).forEach(n=>{
    lks.forEach(l=>{ if(l.from===n.id||l.to===n.id) l.linkFault='cut'; });
    if(n.layer===0) {
      logs.push({ft:'NODE DOWN', msg:`${n.name} — rhizome detached. Non-critical.`, col:C.NODE_DOWN});
    } else {
      const lk=LAYERS[n.layer].key;
      lks.filter(l=>l.from===n.id||l.to===n.id).forEach(l=>{
        const pid=l.from===n.id?l.to:l.from;
        const p=nm[pid]; if(p&&!p.nodeDown&&p.state!=='idle') p.state='degraded';
      });
      logs.push({ft:'NODE DOWN', msg:`${n.name} (${lk}) — all links severed. PATH TERMINATED. Reformation search.`, col:C.NODE_DOWN});
    }
  });

  // ② LINK FAULT 처리 (노드가 살아있는 링크만)
  lks.filter(l=>l.linkFault==='cut'&&alive(l.from)&&alive(l.to)).forEach(l=>{
    const a=nm[l.from],b=nm[l.to]; if(!a||!b) return;
    if(l.kind==='hypercube') {
      l.reroute=true;
      if(active(a.id)||active(b.id))
        logs.push({ft:'LINK FAULT', msg:`LINK CUT — HC ${a.proxCoord}↔${b.proxCoord}. Q-axis reroute activated.`, col:C.Q_REROUTE});
    } else {
      l.coreSwap=true;
      if(active(a.id)||active(b.id))
        logs.push({ft:'LINK FAULT', msg:`LINK CUT — ${l.kind}. Core substitution (same plane).`, col:C.CORE_SWAP});
    }
  });

  // ③ 신호 전파
  lks.filter(l=>l.kind==='rhizome-up'&&!l.linkFault&&alive(l.from)&&alive(l.to)).forEach(l=>{
    const t4=nm[l.from],h6=nm[l.to]; if(!t4||!h6) return;
    if(t4.state!=='idle'){l.active=true; if(h6.state==='idle') h6.state='healing';}
  });
  lks.filter(l=>l.kind==='h6-mesh'&&alive(l.from)&&alive(l.to)).forEach(l=>{
    const a=nm[l.from],b=nm[l.to]; if(!a||!b) return;
    if(l.linkFault==='cut'){l.reroute=true;return;}
    if(active(a.id)&&b.state==='idle'){b.state='healing';l.active=true;}
    if(active(b.id)&&a.state==='idle'){a.state='healing';l.active=true;}
    if(active(a.id)&&active(b.id)) l.active=true;
  });
  lks.filter(l=>l.kind==='hypercube'&&alive(l.from)&&alive(l.to)).forEach(l=>{
    const a=nm[l.from],b=nm[l.to]; if(!a||!b) return;
    if(l.linkFault==='cut'){
      if(active(a.id)&&b.state==='idle') b.state='healing';
      if(active(b.id)&&a.state==='idle') a.state='healing';
      return;
    }
    if(active(a.id)&&b.state==='idle'){b.state='healing';l.active=true;}
    if(active(b.id)&&a.state==='idle'){a.state='healing';l.active=true;}
    if(active(a.id)&&active(b.id)) l.active=true;
  });
  const upCnt={};
  lks.filter(l=>l.kind==='vertical'&&alive(l.from)&&alive(l.to)).forEach(l=>{
    const f=nm[l.from]; if(!f||f.nodeDown) return;
    if(l.linkFault==='cut'){
      if(f.state!=='idle'){l.coreSwap=true; upCnt[l.to]=(upCnt[l.to]||0)+0.5;}
      return;
    }
    if(f.state!=='idle'){
      l.active=true; upCnt[l.to]=(upCnt[l.to]||0)+1;
      if(nm[l.to]?.layer===2&&l.layer===1&&l.e2eHop){
        const h6=nm[l.from],o8=nm[l.to];
        if(h6&&o8){
          const tag=`R${h6.index+1}@${h6.proxCoord}`;
          if(!o8.e2eKnown) o8.e2eKnown=[];
          if(!o8.e2eKnown.includes(tag)){
            o8.e2eKnown.push(tag);
            logs.push({ft:'E2E', msg:`O8(${o8.proxCoord}) maps E2E hop: cluster ${tag}`, col:C.E2E});
          }
        }
      }
    }
  });
  Object.entries(upCnt).forEach(([id,cnt])=>{
    const n=nm[id]; if(!n||n.nodeDown) return;
    if(n.state==='idle'){
      if(n.layer===4){n.state='converged'; logs.push({ft:'VELSA',msg:`I20 — Global coherence restored.`,col:C.I20});}
      else n.state=cnt>=1?'healing':'degraded';
    }
  });
  Object.values(nm).forEach(n=>{ if(n.state==='healing') n.state='rerouted'; });
  return {nodes:Object.values(nm), links:lks, logs};
}

// ══════════════════════════════════════════════════════════════════════
export default function VelsaV3() {
  const [nodes,setNodes]=useState([]);
  const [links,setLinks]=useState([]);
  const [logs,setLogs]=useState([]);
  const [step,setStep]=useState(0);
  const [running,setRunning]=useState(false);
  const [done,setDone]=useState(false);
  const [tick,setTick]=useState(0);
  const [lfRate,setLfRate]=useState(0.12);
  const [seed,setSeed]=useState(42);
  const [hover,setHover]=useState(null);
  const [velMsg,setVelMsg]=useState('VELSA STANDBY');
  const [injectMode,setInjectMode]=useState('node');

  const nRef=useRef([]),lRef=useRef([]),sRef=useRef(0);
  useEffect(()=>{nRef.current=nodes;},[nodes]);
  useEffect(()=>{lRef.current=links;},[links]);
  useEffect(()=>{sRef.current=step;},[step]);
  const ivl=useRef(null),raf=useRef(null),logEl=useRef(null);

  useEffect(()=>{
    let t=0; const loop=()=>{t++;setTick(t);raf.current=requestAnimationFrame(loop);};
    raf.current=requestAnimationFrame(loop);
    return()=>cancelAnimationFrame(raf.current);
  },[]);

  const doReset=useCallback((lfr,s)=>{
    clearInterval(ivl.current);
    setRunning(false);setDone(false);setStep(0);setLogs([]);
    setVelMsg('VELSA STANDBY — Monitoring network state');
    const nn=buildNodes(s);
    const t4s=nn.filter(n=>n.layer===0);
    t4s[Math.floor(Math.random()*t4s.length)].state='alert';
    const h6s=nn.filter(n=>n.layer===1);
    const dh=h6s[Math.floor(Math.random()*h6s.length)];
    dh.nodeDown=true; dh.state='failed';
    setNodes(nn); setLinks(buildLinks(nn,lfr,s));
  },[]);
  useEffect(()=>{doReset(0.12,42);},[]);

  const advance=useCallback(()=>{
    const{nodes:nn,links:nl,logs:newL}=velsaStep(nRef.current,lRef.current);
    const ns=sRef.current+1;
    setNodes(nn);setLinks(nl);setStep(ns);
    if(newL.length){
      setVelMsg(newL[newL.length-1].msg);
      setLogs(p=>[...p.slice(-30),...newL.map(l=>({...l,s:ns}))]);
    }
    if(nn.some(n=>n.layer===4&&n.state==='converged')||ns>40){
      setDone(true);setRunning(false);clearInterval(ivl.current);
      setVelMsg('◎ VELSA — Global coherence confirmed. Network self-healed.');
    }
  },[]);

  const handleStep=()=>{if(!done)advance();};
  const handleAuto=()=>{
    if(done)return;
    if(running){clearInterval(ivl.current);setRunning(false);return;}
    setRunning(true);ivl.current=setInterval(advance,500);
  };
  useEffect(()=>()=>clearInterval(ivl.current),[]);
  useEffect(()=>{if(logEl.current)logEl.current.scrollTop=9999;},[logs]);

  const onNodeClick=n=>{
    if(injectMode!=='node'||n.layer>2)return;
    setNodes(p=>p.map(x=>{
      if(x.id!==n.id)return x;
      const nd=!x.nodeDown;
      return{...x,nodeDown:nd,state:nd?'failed':'idle'};
    }));
  };
  const onLinkClick=(e,l)=>{
    e.stopPropagation();
    if(injectMode!=='link')return;
    setLinks(p=>p.map(x=>{
      if(x.id!==l.id)return x;
      return{...x,linkFault:x.linkFault?false:'cut'};
    }));
  };

  const sc={};nodes.forEach(n=>{sc[n.state]=(sc[n.state]||0)+1;});
  const nodeDownN=nodes.filter(n=>n.nodeDown).length;
  const linkCutN=links.filter(l=>l.linkFault==='cut').length;
  const rerouteN=links.filter(l=>l.reroute).length;
  const coreSwapN=links.filter(l=>l.coreSwap).length;
  const e2eN=links.filter(l=>l.e2eHop&&l.active).length;
  const degN=nodes.filter(n=>n.state==='degraded').length;
  const hNode=hover?nodes.find(n=>n.id===hover):null;

  return (
    <div style={{background:'#020A12',minHeight:'100vh',
      fontFamily:"'Space Mono','Courier New',monospace",
      color:'#C8DCE8',display:'flex',flexDirection:'column',userSelect:'none'}}>

      <div style={{borderBottom:'1px solid #0A1E2E',padding:'8px 18px',
        display:'flex',alignItems:'center',justifyContent:'space-between',
        background:'#020A12',flexShrink:0}}>
        <div style={{display:'flex',alignItems:'center',gap:12}}>
          <span style={{fontSize:14,fontWeight:900,letterSpacing:5,
            color:C.I20,textShadow:`0 0 20px ${C.I20}`}}>VELSA</span>
          <span style={{fontSize:7,letterSpacing:2,color:'#1E3A4A'}}>
            DUAL FAULT RESPONSE SIMULATOR · v3.0
          </span>
        </div>
        <div style={{display:'flex',gap:6,alignItems:'center',flexWrap:'wrap'}}>
          {nodeDownN>0&&<Chip col={C.NODE_DOWN}>⬛ {nodeDownN} NODE DOWN</Chip>}
          {linkCutN>0&&<Chip col={C.LINK_FAULT}>✂ {linkCutN} LINK CUT</Chip>}
          {degN>0&&<Chip col={C.DEGRADED}>⚠ {degN} DEGRADED</Chip>}
          {rerouteN>0&&<Chip col={C.Q_REROUTE}>⟳ {rerouteN} Q-REROUTE</Chip>}
          {coreSwapN>0&&<Chip col={C.CORE_SWAP}>⇄ {coreSwapN} CORE SWAP</Chip>}
          {done&&<Chip col={C.D12}>◎ HEALED</Chip>}
          <span style={{fontSize:7,color:'#1E3A4A',letterSpacing:2}}>STEP {step}</span>
        </div>
      </div>

      <div style={{background:'#030D1A',borderBottom:'1px solid #0A1E2E',
        padding:'5px 18px',display:'flex',alignItems:'center',gap:10,flexShrink:0}}>
        <div style={{width:6,height:6,borderRadius:'50%',flexShrink:0,
          background:done?C.D12:running?C.Q_REROUTE:C.I20,
          boxShadow:`0 0 8px ${done?C.D12:running?C.Q_REROUTE:C.I20}`}}/>
        <span style={{fontSize:8,letterSpacing:1.5,
          color:done?C.D12:running?C.Q_REROUTE:'#2A5060'}}>{velMsg}</span>
      </div>

      <div style={{display:'flex',flex:1,overflow:'hidden'}}>
        <div style={{flex:1,display:'flex',flexDirection:'column',
          gap:5,padding:'8px 6px 6px 12px',minWidth:0}}>

          <div style={{display:'flex',gap:5,alignItems:'center',flexWrap:'wrap',flexShrink:0}}>
            <Btn col='#42A5F5' dis={done} onClick={handleStep}>▶ STEP</Btn>
            <Btn col={running?C.Q_REROUTE:C.D12} dis={done} onClick={handleAuto}>
              {running?'⏸ PAUSE':'⚡ AUTO'}
            </Btn>
            <Btn col={C.I20} onClick={()=>{const s=Date.now()%9999;setSeed(s);doReset(lfRate,s);}}>
              ↺ RESET
            </Btn>

            {/* 장애 주입 모드 토글 */}
            <div style={{display:'flex',border:'1px solid #0A1E2E',borderRadius:4,overflow:'hidden'}}>
              {[
                {k:'node',label:'⬛ NODE DOWN',col:C.NODE_DOWN},
                {k:'link',label:'✂ LINK CUT', col:C.LINK_FAULT},
              ].map(m=>(
                <button key={m.k} onClick={()=>setInjectMode(m.k)}
                  style={{padding:'5px 12px',border:'none',
                    borderRight:m.k==='node'?'1px solid #0A1E2E':'none',
                    background:injectMode===m.k?`${m.col}22`:'transparent',
                    color:injectMode===m.k?m.col:'#1E3A4A',
                    fontSize:7,letterSpacing:1,
                    fontFamily:"'Space Mono',monospace",cursor:'pointer',fontWeight:700}}>
                  {m.label}
                </button>
              ))}
            </div>

            <div style={{display:'flex',alignItems:'center',gap:6,padding:'4px 9px',
              background:'#030D1A',border:'1px solid #0A1E2E',borderRadius:4}}>
              <span style={{fontSize:6,letterSpacing:2,color:'#1E3A4A'}}>INIT LINK</span>
              <input type="range" min={0} max={0.35} step={0.05} value={lfRate}
                onChange={e=>{const v=parseFloat(e.target.value);setLfRate(v);doReset(v,seed);}}
                style={{accentColor:C.LINK_FAULT,width:60}}/>
              <span style={{fontSize:8,color:C.LINK_FAULT,minWidth:24}}>
                {Math.round(lfRate*100)}%
              </span>
            </div>

            <span style={{fontSize:6,color:'#0C1E28'}}>
              {injectMode==='node'?'Click T4/H6/O8 → NODE DOWN':'Click link → LINK CUT'}
            </span>
          </div>

          <div style={{flex:1,background:'#030D1A',border:'1px solid #0A1E2E',
            borderRadius:8,overflow:'hidden'}}>
            <NetSVG nodes={nodes} links={links} tick={tick}
              onNodeClick={onNodeClick} onLinkClick={onLinkClick}
              onHover={setHover} hover={hover} injectMode={injectMode}/>
          </div>

          <div style={{display:'flex',gap:4,flexShrink:0}}>
            {LAYERS.map(layer=>{
              const ns=nodes.filter(n=>n.layer===layer.id);
              const act=ns.filter(n=>n.state!=='idle'&&!n.nodeDown).length;
              const down=ns.filter(n=>n.nodeDown).length;
              const deg=ns.filter(n=>n.state==='degraded').length;
              const total=ns.length;
              return(
                <div key={layer.id} style={{flex:1,padding:'5px 7px',background:'#030D1A',
                  border:`1px solid ${layer.color}${layer.hcDim>0&&layer.id>0?'44':'1A'}`,
                  borderRadius:5,borderLeft:`2px solid ${layer.color}`}}>
                  <div style={{display:'flex',justifyContent:'space-between'}}>
                    <span style={{fontSize:8,letterSpacing:2,color:layer.color,fontWeight:700}}>
                      {layer.key}</span>
                    <span style={{fontSize:7,color:act>0?layer.color:'#1E3A4A'}}>{act}/{total}</span>
                  </div>
                  {layer.ai&&<div style={{fontSize:5.5,color:layer.color,opacity:.45,
                    letterSpacing:1,marginTop:1}}>
                    {layer.ai}{layer.hcDim>0&&layer.id>0?` Q${layer.hcDim+3}`:''}</div>}
                  {down>0&&<div style={{fontSize:5.5,color:C.NODE_DOWN,marginTop:1}}>
                    ⬛{down} down</div>}
                  {deg>0&&<div style={{fontSize:5.5,color:C.DEGRADED,marginTop:1}}>
                    ⚠{deg} deg</div>}
                  <div style={{marginTop:3,height:2,background:'#091820',borderRadius:1}}>
                    <div style={{width:`${total?act/total*100:0}%`,height:'100%',
                      background:layer.color,borderRadius:1,transition:'width .3s'}}/>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Right panel */}
        <div style={{width:278,borderLeft:'1px solid #0A1E2E',display:'flex',
          flexDirection:'column',overflow:'hidden',flexShrink:0}}>

          {hNode&&<HoverCard node={hNode} nodes={nodes} links={links}/>}

          {/* 장애 2종 설명 */}
          <div style={{padding:'10px 13px',borderBottom:'1px solid #0A1E2E',flexShrink:0}}>
            <div style={{fontSize:7,letterSpacing:4,color:'#1E3A4A',marginBottom:7}}>FAULT TYPES</div>

            <div style={{marginBottom:8,padding:'7px 9px',
              background:`${C.NODE_DOWN}08`,
              border:`1px solid ${C.NODE_DOWN}30`,borderRadius:4}}>
              <div style={{fontSize:8,color:C.NODE_DOWN,fontWeight:700,
                letterSpacing:.5,marginBottom:4}}>⬛ NODE DOWN — 장비 다운</div>
              <div style={{fontSize:6.5,color:'#254050',lineHeight:1.9}}>
                장비 전원/HW 완전 사망<br/>
                연결된 <span style={{color:'#3A6070'}}>모든 링크 동시 단절</span><br/>
                T4: 비중요 — rhizome detach<br/>
                H6+: <span style={{color:C.NODE_DOWN,fontWeight:700}}>Path Terminated</span><br/>
                VELSA → 새 E2E 경로 재탐색
              </div>
            </div>

            <div style={{padding:'7px 9px',
              background:`${C.LINK_FAULT}08`,
              border:`1px solid ${C.LINK_FAULT}30`,borderRadius:4}}>
              <div style={{fontSize:8,color:C.LINK_FAULT,fontWeight:700,
                letterSpacing:.5,marginBottom:4}}>✂ LINK CUT — 링크 손실</div>
              <div style={{fontSize:6.5,color:'#254050',lineHeight:1.9}}>
                광코어/리본케이블 물리 단절<br/>
                노드 자체는 <span style={{color:'#3A6070'}}>생존</span><br/>
                HC 링크: <span style={{color:C.Q_REROUTE,fontWeight:700}}>Q-axis reroute</span><br/>
                수직/mesh: <span style={{color:C.CORE_SWAP,fontWeight:700}}>Core substitution</span><br/>
                VELSA → 동일 plane 내 복구
              </div>
            </div>
          </div>

          {/* Stats */}
          <div style={{padding:'9px 13px',borderBottom:'1px solid #0A1E2E',flexShrink:0}}>
            <div style={{fontSize:7,letterSpacing:4,color:'#1E3A4A',marginBottom:6}}>VELSA STATE</div>
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:3}}>
              {[
                {l:'NODE DOWN', v:nodeDownN, c:C.NODE_DOWN},
                {l:'LINK CUT',  v:linkCutN,  c:C.LINK_FAULT},
                {l:'DEGRADED',  v:degN,      c:C.DEGRADED},
                {l:'Q-REROUTE', v:rerouteN,  c:C.Q_REROUTE},
                {l:'CORE SWAP', v:coreSwapN, c:C.CORE_SWAP},
                {l:'E2E HOPS',  v:e2eN,      c:C.E2E},
              ].map(s=>(
                <div key={s.l} style={{padding:'5px 7px',background:'#030D1A',
                  border:`1px solid ${s.c}18`,borderRadius:3}}>
                  <div style={{fontSize:18,fontWeight:700,lineHeight:1,
                    color:s.v>0?s.c:'#1E3A4A'}}>{s.v}</div>
                  <div style={{fontSize:5.5,letterSpacing:1.5,
                    color:'#1E3A4A',marginTop:2}}>{s.l}</div>
                </div>
              ))}
            </div>
          </div>

          {/* WP#17 복구 순서 */}
          <div style={{padding:'9px 13px',borderBottom:'1px solid #0A1E2E',flexShrink:0}}>
            <div style={{fontSize:7,letterSpacing:4,color:'#1E3A4A',marginBottom:6}}>
              WP#17 RECOVERY ORDER
            </div>
            {[
              {n:1,col:C.CORE_SWAP,t:'Core substitution',d:'Link cut — same plane'},
              {n:2,col:C.Q_REROUTE,t:'Q-axis reroute',   d:'HC link cut — alt dim'},
              {n:3,col:C.DEGRADED, t:'Degraded state',   d:'Partial constraint loss'},
              {n:4,col:C.NODE_DOWN,t:'Path Terminated',  d:'Node down → new formation'},
            ].map(r=>(
              <div key={r.n} style={{display:'flex',gap:7,alignItems:'flex-start',marginBottom:5}}>
                <div style={{width:15,height:15,borderRadius:3,flexShrink:0,
                  background:`${r.col}20`,border:`1px solid ${r.col}`,
                  display:'flex',alignItems:'center',justifyContent:'center',
                  fontSize:7,color:r.col,fontWeight:700}}>{r.n}</div>
                <div>
                  <div style={{fontSize:7,color:r.col,letterSpacing:.5}}>{r.t}</div>
                  <div style={{fontSize:6,color:'#1E4050'}}>{r.d}</div>
                </div>
              </div>
            ))}
          </div>

          {/* Event log */}
          <div style={{flex:1,padding:'7px 13px',overflow:'hidden',
            display:'flex',flexDirection:'column'}}>
            <div style={{fontSize:7,letterSpacing:4,color:'#1E3A4A',marginBottom:4}}>EVENT LOG</div>
            <div ref={logEl} style={{flex:1,overflowY:'auto',display:'flex',
              flexDirection:'column',gap:2.5,scrollbarWidth:'thin',
              scrollbarColor:'#0A1E2E transparent'}}>
              {!logs.length&&<div style={{fontSize:7,color:'#0C2030'}}>Awaiting VELSA activation...</div>}
              {logs.map((l,i)=>(
                <div key={i} style={{fontSize:7,lineHeight:1.65,
                  borderLeft:`2px solid ${l.col||'#0A1E2E'}44`,paddingLeft:5}}>
                  <span style={{fontSize:5.5,padding:'1px 4px',marginRight:5,
                    borderRadius:2,fontWeight:700,letterSpacing:.5,
                    background:
                      l.ft==='NODE DOWN'?`${C.NODE_DOWN}22`:
                      l.ft==='LINK FAULT'?`${C.LINK_FAULT}22`:
                      l.ft==='VELSA'?`${C.I20}22`:`${C.E2E}22`,
                    color:
                      l.ft==='NODE DOWN'?C.NODE_DOWN:
                      l.ft==='LINK FAULT'?C.LINK_FAULT:
                      l.ft==='VELSA'?C.I20:C.E2E}}>
                    {l.ft||'SYS'}
                  </span>
                  <span style={{color:'#1E3A4A',marginRight:3}}>[{l.s}]</span>
                  <span style={{color:l.col||'#1E4A5A'}}>{l.msg}</span>
                </div>
              ))}
            </div>
          </div>

          {done&&(
            <div style={{padding:'9px 13px',borderTop:`1px solid ${C.D12}44`,
              background:'rgba(0,200,83,0.04)',textAlign:'center',flexShrink:0}}>
              <div style={{fontSize:10,letterSpacing:3,color:C.D12,
                textShadow:`0 0 12px ${C.D12}`}}>◎ VELSA COHERENT</div>
              <div style={{fontSize:6,color:'#1E5040',lineHeight:1.8,marginTop:3}}>
                Healed in {step} steps · No data loss
              </div>
              <button onClick={()=>{const s=Date.now()%9999;setSeed(s);doReset(lfRate,s);}}
                style={{marginTop:6,width:'100%',padding:5,
                  background:`${C.D12}10`,border:`1px solid ${C.D12}`,
                  borderRadius:3,color:C.D12,fontSize:7,letterSpacing:2,
                  fontFamily:"'Space Mono',monospace",cursor:'pointer'}}>
                ↺ NEW SCENARIO
              </button>
            </div>
          )}
        </div>
      </div>
      <style>{`@keyframes pulse{0%,100%{opacity:1}50%{opacity:.3}}`}</style>
    </div>
  );
}

// ── NetSVG ─────────────────────────────────────────────────────────────
function NetSVG({nodes,links,tick,onNodeClick,onLinkClick,onHover,hover,injectMode}){
  const nm={}; nodes.forEach(n=>{nm[n.id]=n;});
  return(
    <svg width="100%" height="100%" viewBox={`0 0 ${W} ${H}`}>
      <defs>
        <filter id="g3"><feGaussianBlur stdDeviation="3" result="b"/>
          <feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
        <filter id="g7"><feGaussianBlur stdDeviation="7" result="b"/>
          <feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
      </defs>
      {LAYERS.map((layer,li)=>{
        const yc=LY[li],bh=li===0?105:li===4?55:78;
        return(<g key={layer.id}>
          <rect x={0} y={yc-bh/2} width={W} height={bh} fill={layer.color} fillOpacity={0.02}/>
          <text x={16} y={yc+3} fontSize={8} letterSpacing={2}
            fill={layer.color} fillOpacity={0.36} fontFamily="monospace">{layer.key}</text>
          {layer.ai&&<text x={16} y={yc+13} fontSize={6} letterSpacing={1}
            fill={layer.color} fillOpacity={0.24} fontFamily="monospace">{layer.ai}</text>}
          {layer.hcDim>0&&layer.id>0&&
            <text x={W-14} y={yc+3} fontSize={6} letterSpacing={1} textAnchor="end"
              fill={layer.color} fillOpacity={0.26} fontFamily="monospace">
              Q{layer.hcDim+3} HC</text>}
        </g>);
      })}

      {links.map(l=>{
        const a=nm[l.from],b=nm[l.to]; if(!a||!b) return null;
        const col=LAYERS[Math.min(l.layer,4)]?.color||'#fff';
        const fromDown=nm[l.from]?.nodeDown, toDown=nm[l.to]?.nodeDown;

        // NODE DOWN으로 끊긴 링크
        if(fromDown||toDown) return(
          <line key={l.id} x1={a.x} y1={a.y} x2={b.x} y2={b.y}
            stroke={C.NODE_DOWN} strokeOpacity={0.1} strokeWidth={0.7} strokeDasharray="1,9"/>
        );

        // LINK CUT — 주황 점선 + ✂
        if(l.linkFault==='cut') return(
          <g key={l.id} onClick={e=>onLinkClick(e,l)} style={{cursor:'pointer'}}>
            <line x1={a.x} y1={a.y} x2={b.x} y2={b.y}
              stroke={C.LINK_FAULT} strokeOpacity={0.5} strokeWidth={1.5} strokeDasharray="4,7"/>
            <text x={(a.x+b.x)/2} y={(a.y+b.y)/2}
              textAnchor="middle" dominantBaseline="middle"
              fontSize={10} fill={C.LINK_FAULT} fillOpacity={0.7}>✂</text>
            <line x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke="transparent" strokeWidth={14}/>
          </g>
        );

        // Q-REROUTE — 황금 점선
        if(l.reroute) return(
          <line key={l.id} x1={a.x} y1={a.y} x2={b.x} y2={b.y}
            stroke={C.Q_REROUTE} strokeOpacity={0.8} strokeWidth={2.2}
            strokeDasharray="7,3" filter="url(#g3)"/>
        );

        // CORE SWAP — 핑크
        if(l.coreSwap) return(
          <g key={l.id}>
            <line x1={a.x} y1={a.y} x2={b.x} y2={b.y}
              stroke={C.CORE_SWAP} strokeOpacity={0.7} strokeWidth={1.8}
              strokeDasharray="5,3" filter="url(#g3)"/>
            <text x={(a.x+b.x)/2} y={(a.y+b.y)/2-8}
              textAnchor="middle" fontSize={8} fill={C.CORE_SWAP} fillOpacity={0.8}>⇄</text>
          </g>
        );

        // ACTIVE
        if(l.active){
          const sw=l.kind==='hypercube'?2.5:l.e2eHop?2:1.5;
          const fc=l.e2eHop?C.E2E:col;
          return(
            <g key={l.id}
              onClick={injectMode==='link'?e=>onLinkClick(e,l):undefined}
              style={injectMode==='link'?{cursor:'pointer'}:{}}>
              <line x1={a.x} y1={a.y} x2={b.x} y2={b.y}
                stroke={fc} strokeOpacity={0.88} strokeWidth={sw} filter="url(#g3)"/>
              {injectMode==='link'&&
                <line x1={a.x} y1={a.y} x2={b.x} y2={b.y}
                  stroke="transparent" strokeWidth={12}/>}
            </g>
          );
        }

        // IDLE
        const op=l.kind==='hypercube'?0.13:l.e2eHop?0.17:l.kind==='vertical'?0.07:0.08;
        const sw=l.kind==='hypercube'?0.9:0.6;
        const da=l.kind==='rhizome-up'?'2,6':l.kind==='vertical'?'3,8':'';
        return(
          <g key={l.id}
            onClick={injectMode==='link'?e=>onLinkClick(e,l):undefined}
            style={injectMode==='link'?{cursor:'pointer'}:{}}>
            <line x1={a.x} y1={a.y} x2={b.x} y2={b.y}
              stroke={l.e2eHop?C.E2E:col}
              strokeOpacity={l.e2eHop?op*1.6:op}
              strokeWidth={sw} strokeDasharray={da}/>
            {injectMode==='link'&&
              <line x1={a.x} y1={a.y} x2={b.x} y2={b.y}
                stroke="transparent" strokeWidth={14}/>}
          </g>
        );
      })}

      {/* 파티클 */}
      {links.filter(l=>l.active&&!l.linkFault&&!nm[l.from]?.nodeDown&&!nm[l.to]?.nodeDown)
        .map((l,i)=>{
          const a=nm[l.from],b=nm[l.to]; if(!a||!b) return null;
          const col=LAYERS[Math.min(l.layer,4)]?.color||'#fff';
          const fc=l.e2eHop?C.E2E:col;
          const spd=l.kind==='hypercube'?0.055:l.kind==='rhizome-up'?0.04:0.045;
          const t=((tick*spd)+i*0.13)%1;
          return(<circle key={`p${l.id}`}
            cx={a.x+(b.x-a.x)*t} cy={a.y+(b.y-a.y)*t}
            r={l.kind==='hypercube'?3.5:2.8}
            fill={fc} opacity={0.88} filter="url(#g3)"/>);
        })}
      {links.filter(l=>l.reroute).map((l,i)=>{
        const a=nm[l.from],b=nm[l.to]; if(!a||!b) return null;
        const t=((tick*0.05)+i*0.2)%1;
        return(<circle key={`rp${l.id}`}
          cx={a.x+(b.x-a.x)*t} cy={a.y+(b.y-a.y)*t}
          r={3} fill={C.Q_REROUTE} opacity={0.85} filter="url(#g3)"/>);
      })}

      {/* 노드 */}
      {nodes.map(n=>{
        const layer=LAYERS[n.layer];
        const isHov=n.id===hover;
        const pulse=(n.state!=='idle'&&!n.nodeDown)?0.55+Math.sin(tick*0.07+n.phase)*0.45:1;
        const r=BR[n.layer]+(n.state==='converged'?5:0)+(n.state==='alert'?3:0)+(isHov?2:0);
        let fill='#040E1A',stroke=layer.color,sw=1,sop=0.22,flt='';
        if(n.nodeDown){fill='#0A0A0A';stroke=C.NODE_DOWN;sw=1.8;sop=0.7;}
        else if(n.state==='alert'){fill='#3A0000';stroke=C.NODE_DOWN;sw=2;sop=1;flt='url(#g3)';}
        else if(n.state==='degraded'){fill='#1A0D00';stroke=C.DEGRADED;sw=2;sop=1;flt='url(#g3)';}
        else if(n.state==='healing'){fill='#001830';stroke=layer.color;sw=2;sop=0.9;flt='url(#g3)';}
        else if(n.state==='rerouted'){fill='#1A0F00';stroke=C.Q_REROUTE;sw=2;sop=1;flt='url(#g3)';}
        else if(n.state==='converged'){fill='#0A1A05';stroke=layer.color;sw=2.5;sop=1;flt='url(#g7)';}
        else if(isHov){sw=1.5;sop=0.5;}

        return(
          <g key={n.id}
            style={{cursor:n.layer<=2?'pointer':'default'}}
            onClick={()=>onNodeClick(n)}
            onMouseEnter={()=>onHover(n.id)}
            onMouseLeave={()=>onHover(null)}>
            {n.state!=='idle'&&!n.nodeDown&&(
              <circle cx={n.x} cy={n.y} r={r+15}
                fill={n.state==='degraded'?C.DEGRADED:n.state==='rerouted'?C.Q_REROUTE:layer.color}
                opacity={pulse*0.05} filter="url(#g7)"/>
            )}
            {n.layer===4&&(
              <circle cx={n.x} cy={n.y} r={r+14} fill="none"
                stroke={layer.color} strokeWidth={0.8}
                strokeOpacity={n.state!=='idle'?pulse*0.4:0.1} strokeDasharray="4,7"/>
            )}
            {LAYERS[n.layer].hcDim>0&&n.layer>0&&!n.nodeDown&&(
              <circle cx={n.x} cy={n.y} r={r+8} fill="none"
                stroke={n.state!=='idle'?stroke:layer.color}
                strokeWidth={0.7}
                strokeOpacity={n.state!=='idle'?pulse*0.35:0.08} strokeDasharray="2,6"/>
            )}
            <circle cx={n.x} cy={n.y} r={r} fill={fill}
              stroke={stroke} strokeWidth={sw} strokeOpacity={sop}
              filter={flt||undefined}/>
            {n.nodeDown?(
              <text x={n.x} y={n.y+1} textAnchor="middle" dominantBaseline="middle"
                fontSize={r>12?15:12} fill={C.NODE_DOWN} fillOpacity={0.9}>✕</text>
            ):n.layer===4?(
              <text x={n.x} y={n.y+1} textAnchor="middle" dominantBaseline="middle"
                fontSize={8} fill={layer.color} fillOpacity={0.9}
                fontFamily="monospace" letterSpacing={1}>VELSA</text>
            ):n.layer===0?(
              <text x={n.x} y={n.y+1} textAnchor="middle" dominantBaseline="middle"
                fontSize={6} fill={n.state==='idle'?layer.color:'#fff'}
                fillOpacity={n.state==='idle'?0.5:0.9} fontFamily="monospace">
                {`R${n.cluster+1}-${String(n.index+1).padStart(2,'0')}`}</text>
            ):(
              <text x={n.x} y={n.y+1} textAnchor="middle" dominantBaseline="middle"
                fontSize={7} fill={n.state==='idle'?layer.color:'#fff'}
                fillOpacity={n.state==='idle'?0.5:0.9} fontFamily="monospace">
                {n.proxCoord}</text>
            )}
          </g>
        );
      })}
      {nodes.filter(n=>n.layer===4).map(n=>(
        <text key={`lb${n.id}`} x={n.x} y={n.y-38}
          textAnchor="middle" fontSize={7} letterSpacing={2}
          fill={C.I20} fillOpacity={0.45} fontFamily="monospace">
          {n.state==='converged'?'◎ COHERENT':n.state!=='idle'?'◈ SENSING':'◯ STANDBY'}
        </text>
      ))}
    </svg>
  );
}

function HoverCard({node,nodes,links}){
  const layer=LAYERS[node.layer];
  const parentH6=node.layer===0?nodes.find(n=>n.id===node.parentH6):null;
  const myLinks=links.filter(l=>l.from===node.id||l.to===node.id);
  const cutLinks=myLinks.filter(l=>l.linkFault==='cut').length;
  return(
    <div style={{padding:'9px 12px',borderBottom:'1px solid #0A1E2E',
      background:'#020D18',flexShrink:0}}>
      <div style={{fontSize:7,letterSpacing:3,color:'#1E3A4A',marginBottom:4}}>NODE INFO</div>
      <div style={{fontSize:8.5,color:layer.color,fontFamily:'monospace',
        letterSpacing:.4,marginBottom:3}}>{node.name}</div>
      <div style={{fontSize:7,color:'#1E4A5A',lineHeight:1.8}}>
        {node.nodeDown
          ?<><span style={{color:C.NODE_DOWN,fontWeight:700}}>⬛ NODE DOWN</span><br/></>
          :<><span style={{color:'#1E3A4A'}}>STATE: </span>
            <span style={{color:node.state==='degraded'?C.DEGRADED:
              node.state==='idle'?'#1E4A5A':layer.color}}>
              {node.state.toUpperCase()}</span><br/></>}
        {node.proxCoord&&<>
          <span style={{color:'#1E3A4A'}}>ADDR: </span>
          <span style={{color:layer.color,fontFamily:'monospace'}}>{node.proxCoord}</span><br/></>}
        {parentH6&&<>
          <span style={{color:'#1E3A4A'}}>CLUSTER: </span>
          <span style={{color:C.T4}}>R{node.cluster+1}</span>
          <span style={{color:'#1E3A4A'}}> → H6 </span>
          <span style={{color:C.H6,fontSize:6.5,fontFamily:'monospace'}}>{parentH6.proxCoord}</span><br/></>}
        {node.e2eKnown?.length>0&&<>
          <span style={{color:'#1E3A4A'}}>E2E: </span>
          <span style={{color:C.E2E,fontSize:6}}>{node.e2eKnown.join(' ')}</span><br/></>}
        {cutLinks>0&&<span style={{color:C.LINK_FAULT}}>✂ {cutLinks} link(s) cut</span>}
      </div>
    </div>
  );
}

function Btn({col,dis,onClick,children}){
  return(
    <button onClick={onClick} disabled={dis}
      style={{padding:'5px 11px',background:dis?'#030D1A':`${col}12`,
        border:`1px solid ${dis?'#0A1E2E':col}`,borderRadius:3,
        color:dis?'#1E3A4A':col,fontSize:7,letterSpacing:2,
        fontFamily:"'Space Mono',monospace",cursor:dis?'not-allowed':'pointer',fontWeight:700}}>
      {children}
    </button>
  );
}
function Chip({col,children}){
  return(
    <span style={{fontSize:6,letterSpacing:1.5,color:col,padding:'2px 6px',
      border:`1px solid ${col}`,borderRadius:2,textShadow:`0 0 5px ${col}`}}>
      {children}
    </span>
  );
}
