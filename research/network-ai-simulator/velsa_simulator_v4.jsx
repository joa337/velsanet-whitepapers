import { useState, useEffect, useRef, useCallback, useMemo } from "react";

// ══════════════════════════════════════════════════════════════════════
//  VELSA Network AI Simulator v4.0
//  전체 T4 → H6 → O8 → D12 → I20 계층 구조
//  기능: 병렬 E2E 요청, 슬립모드, 장애대응, 하이퍼큐브 전파, 소버린 정책
// ══════════════════════════════════════════════════════════════════════

const REGION = "KR01";
const W = 1200, H = 700;
const LY = [630, 510, 385, 255, 110]; // T4→I20 y좌표
const LXR = [[60,1140],[80,1120],[130,1070],[280,920],[500,700]];
const BR = [7, 11, 14, 18, 26];

const C = {
  T4: '#00E5FF', H6: '#78909C', O8: '#2979FF',
  D12: '#00C853', I20: '#AA00FF',
  SLEEP: '#37474F', FAULT: '#FF1744', WARN: '#FF9800',
  E2E: '#E040FB', REROUTE: '#FFD740', HCPROP: '#76FF03',
  SOVEREIGN: '#FF6D00', BG: '#060B14',
  GRID: 'rgba(255,255,255,0.03)', TEXT: '#E0E8FF',
};

const LAYER_META = [
  { key:'T4',  color:C.T4,  ai:null,    label:'T4 · Access',      desc:'Edge/Sensor' },
  { key:'H6',  color:C.H6,  ai:null,    label:'H6 · Proximity',   desc:'Mesh Cluster' },
  { key:'O8',  color:C.O8,  ai:'PAI',   label:'O8 · City',        desc:'PAI · Structure Recognition' },
  { key:'D12', color:C.D12, ai:'AAI',   label:'D12 · Region',     desc:'AAI · Convergence' },
  { key:'I20', color:C.I20, ai:'AsAI',  label:'I20 · National',   desc:'AsAI · Sovereign' },
];

function mkRng(s){ let r=s|0; return ()=>{ r=(r*1664525+1013904223)&0xffffffff; return (r>>>0)/0xffffffff; }; }

// ─── 노드 생성 ───────────────────────────────────────────────────────
function buildNodes(seed=42){
  const r=mkRng(seed); const nodes=[];
  const H6_N=8, O8_N=8, D12_N=4;

  // I20
  nodes.push({ id:'4-0', layer:4, index:0, name:`I20-Q4-${REGION}-01`,
    x:(LXR[4][0]+LXR[4][1])/2, y:LY[4], state:'active', usage:0.85,
    sovereign:'national', hcCoord:'01' });

  // D12
  for(let i=0;i<D12_N;i++){
    const t=i/(D12_N-1); const[xl,xr]=LXR[3];
    nodes.push({ id:`3-${i}`, layer:3, index:i, name:`D12-Q5-${REGION}-${i.toString(2).padStart(2,'0')}`,
      x:xl+t*(xr-xl)+(r()-.5)*15, y:LY[3]+(r()-.5)*14,
      state:'active', usage:0.4+r()*0.4, sovereign:'regional', hcCoord:i.toString(2).padStart(2,'0') });
  }

  // O8
  for(let i=0;i<O8_N;i++){
    const t=i/(O8_N-1); const[xl,xr]=LXR[2];
    nodes.push({ id:`2-${i}`, layer:2, index:i, name:`O8-Q6-${REGION}-${i.toString(2).padStart(3,'0')}`,
      x:xl+t*(xr-xl)+(r()-.5)*14, y:LY[2]+(r()-.5)*13,
      state:'active', usage:0.3+r()*0.5, sovereign:'city', hcCoord:i.toString(2).padStart(3,'0'),
      e2eKnown:[] });
  }

  // H6
  for(let i=0;i<H6_N;i++){
    const t=i/(H6_N-1); const[xl,xr]=LXR[1];
    nodes.push({ id:`1-${i}`, layer:1, index:i, name:`H6-Q7-${REGION}-${i.toString(2).padStart(3,'0')}`,
      x:xl+t*(xr-xl)+(r()-.5)*18, y:LY[1]+(r()-.5)*22,
      state:'active', usage:0.2+r()*0.6, hcCoord:i.toString(2).padStart(3,'0'), clusterOf:[] });
  }

  // T4
  const h6nodes = nodes.filter(n=>n.layer===1);
  h6nodes.forEach((h6,ci)=>{
    const cnt=2+Math.floor(r()*3);
    for(let j=0;j<cnt;j++){
      nodes.push({ id:`0-${ci}-${j}`, layer:0, index:j, name:`T4-${REGION}-R${ci+1}-${String(j+1).padStart(3,'0')}`,
        x:h6.x+(j-(cnt-1)/2)*44+(r()-.5)*10, y:LY[0]+(r()-.5)*28,
        state:'active', usage:0.1+r()*0.7, parentH6:h6.id, cluster:ci });
    }
    h6.clusterOf = nodes.filter(n=>n.parentH6===h6.id).map(n=>n.id);
  });

  return nodes;
}

// ─── 링크 생성 ───────────────────────────────────────────────────────
function buildLinks(nodes){
  const links=[];
  const byLayer = l => nodes.filter(n=>n.layer===l);

  // T4 → H6
  nodes.filter(n=>n.layer===0).forEach(t4=>{
    const h6=nodes.find(n=>n.id===t4.parentH6);
    if(h6) links.push({ id:`l-${t4.id}-${h6.id}`, src:t4.id, dst:h6.id, type:'access', state:'ok' });
  });

  // H6 → O8 (각 H6는 2개 O8에 연결)
  byLayer(1).forEach((h6,i)=>{
    const o8a=byLayer(2)[i%8], o8b=byLayer(2)[(i+1)%8];
    links.push({ id:`l-${h6.id}-${o8a.id}`, src:h6.id, dst:o8a.id, type:'mesh', state:'ok' });
    links.push({ id:`l-${h6.id}-${o8b.id}`, src:h6.id, dst:o8b.id, type:'mesh', state:'ok' });
  });

  // O8 하이퍼큐브 (3비트: 000~111, 1비트 차이 연결)
  byLayer(2).forEach((o8a,i)=>{
    byLayer(2).forEach((o8b,j)=>{
      if(i<j){
        const diff=(i^j); const bits=diff.toString(2).split('').filter(b=>b==='1').length;
        if(bits===1) links.push({ id:`l-${o8a.id}-${o8b.id}`, src:o8a.id, dst:o8b.id, type:'hypercube', state:'ok' });
      }
    });
  });

  // O8 → D12
  byLayer(2).forEach((o8,i)=>{
    const d12=byLayer(3)[Math.floor(i/2)%4];
    links.push({ id:`l-${o8.id}-${d12.id}`, src:o8.id, dst:d12.id, type:'vertical', state:'ok' });
  });

  // D12 → I20
  byLayer(3).forEach(d12=>{
    const i20=byLayer(4)[0];
    links.push({ id:`l-${d12.id}-${i20.id}`, src:d12.id, dst:i20.id, type:'sovereign', state:'ok' });
  });

  return links;
}

// ─── 이벤트 로그 ─────────────────────────────────────────────────────
let logId=0;
function mkLog(layer, msg, type='info'){
  return { id:logId++, ts:Date.now(), layer, msg, type };
}

// ════════════════════════════════════════════════════════════════════
//  메인 컴포넌트
// ════════════════════════════════════════════════════════════════════
export default function VelsaSimulator(){
  const [nodes, setNodes]   = useState(()=>buildNodes(42));
  const [links, setLinks]   = useState(()=>buildLinks(buildNodes(42)));
  const [logs, setLogs]     = useState([mkLog('SYSTEM','VELSA Network AI v4.0 초기화 완료','success')]);
  const [packets, setPackets] = useState([]);   // 이동 중인 패킷 애니메이션
  const [mode, setMode]     = useState('monitor'); // monitor | e2e | fault | sleep | sovereign
  const [selected, setSelected] = useState(null);
  const [tick, setTick]     = useState(0);
  const [stats, setStats]   = useState({ activeNodes:0, sleepNodes:0, faultNodes:0, e2eCount:0, rerouteCount:0 });
  const [e2ePaths, setE2ePaths] = useState([]); // 활성 E2E 경로
  const [hcWave, setHcWave] = useState(null);   // 하이퍼큐브 전파 시각화
  const [sovereignAlert, setSovereignAlert] = useState(null);
  const svgRef = useRef();
  const animRef = useRef();
  const packetIdRef = useRef(0);

  const nodeMap = useMemo(()=> Object.fromEntries(nodes.map(n=>[n.id,n])), [nodes]);

  // ─── 통계 업데이트 ───────────────────────────────────────────────
  useEffect(()=>{
    setStats({
      activeNodes: nodes.filter(n=>n.state==='active').length,
      sleepNodes:  nodes.filter(n=>n.state==='sleep').length,
      faultNodes:  nodes.filter(n=>n.state==='fault').length,
      e2eCount:    e2ePaths.length,
      rerouteCount: links.filter(l=>l.state==='reroute').length,
    });
  },[nodes, links, e2ePaths]);

  // ─── 틱 루프 (usage 변동) ────────────────────────────────────────
  useEffect(()=>{
    const id=setInterval(()=>{
      setTick(t=>t+1);
      setNodes(prev=>prev.map(n=>{
        if(n.state==='fault'||n.state==='sleep') return n;
        const delta=(Math.random()-.48)*0.04;
        return {...n, usage:Math.max(0.05, Math.min(0.98, (n.usage||0.5)+delta))};
      }));
      // 패킷 이동
      setPackets(prev=>prev.map(p=>({...p, progress:p.progress+p.speed})).filter(p=>p.progress<1));
    }, 150);
    return ()=>clearInterval(id);
  },[]);

  // ─── 로그 추가 헬퍼 ──────────────────────────────────────────────
  const addLog = useCallback((layer, msg, type='info')=>{
    setLogs(prev=>[mkLog(layer,msg,type),...prev].slice(0,120));
  },[]);

  // ─── 패킷 발사 헬퍼 ──────────────────────────────────────────────
  const firePacket = useCallback((srcId, dstId, color='#E040FB', size=5)=>{
    const src=nodeMap[srcId], dst=nodeMap[dstId];
    if(!src||!dst) return;
    setPackets(prev=>[...prev, {
      id: packetIdRef.current++, srcId, dstId,
      x1:src.x, y1:src.y, x2:dst.x, y2:dst.y,
      color, size, progress:0, speed:0.04+Math.random()*0.03,
    }].slice(-80));
  },[nodeMap]);

  // ─── 병렬 E2E 요청 처리 ─────────────────────────────────────────
  const handleE2ERequest = useCallback(()=>{
    const t4s = nodes.filter(n=>n.layer===0&&n.state==='active');
    const i20  = nodes.find(n=>n.layer===4);
    if(t4s.length<2||!i20) return;

    const src=t4s[Math.floor(Math.random()*t4s.length)];
    const dst=t4s[Math.floor(Math.random()*t4s.length)];
    if(src.id===dst.id) return;

    // 경로: T4 → H6 → O8 → D12 → I20 → D12 → O8 → H6 → T4
    const srcH6 = nodes.find(n=>n.id===src.parentH6);
    const dstH6 = nodes.find(n=>n.id===dst.parentH6);
    const o8s   = nodes.filter(n=>n.layer===2&&n.state==='active');
    const d12s  = nodes.filter(n=>n.layer===3&&n.state==='active');
    if(!srcH6||!dstH6||!o8s.length||!d12s.length) return;

    const srcO8=o8s[Math.floor(Math.random()*o8s.length)];
    const dstO8=o8s[Math.floor(Math.random()*o8s.length)];
    const midD12=d12s[Math.floor(Math.random()*d12s.length)];

    const path=[src.id, srcH6.id, srcO8.id, midD12.id, i20.id, midD12.id, dstO8.id, dstH6.id, dst.id];

    // 패킷 연속 발사
    let delay=0;
    for(let i=0;i<path.length-1;i++){
      setTimeout(()=>firePacket(path[i], path[i+1], C.E2E), delay);
      delay+=180;
    }

    setE2ePaths(prev=>[...prev,{ id:Date.now(), path, ts:Date.now() }].slice(-10));

    addLog('O8', `병렬 E2E 요청 시작: ${src.name.slice(-6)} → ${dst.name.slice(-6)}`, 'info');
    setTimeout(()=>addLog('D12','지역 수렴: 경로 충돌 검사 완료', 'info'), 400);
    setTimeout(()=>addLog('I20','글로벌 판단: E2E 경로 확정 및 실행 명령 생성', 'success'), 800);
    setTimeout(()=>addLog('O8','하향 적용 완료: 경로 활성화', 'success'), 1200);
  },[nodes, firePacket, addLog]);

  // ─── 장애 주입 ───────────────────────────────────────────────────
  const handleFaultInject = useCallback(()=>{
    const candidates=nodes.filter(n=>n.layer>=1&&n.layer<=3&&n.state==='active');
    if(!candidates.length) return;
    const target=candidates[Math.floor(Math.random()*candidates.length)];

    setNodes(prev=>prev.map(n=>n.id===target.id?{...n,state:'fault',usage:0}:n));
    setLinks(prev=>prev.map(l=>
      (l.src===target.id||l.dst===target.id)?{...l,state:'fault'}:l
    ));

    addLog(LAYER_META[target.layer].key, `⚠ 장애 감지: ${target.name}`, 'error');

    // 하이퍼큐브 전파 (O8 레이어)
    if(target.layer===2){
      setHcWave({ origin:target.id, ts:Date.now(), radius:0 });
      addLog('O8','하이퍼큐브 수평 전파 시작','warn');
    }

    // 자가복구 시퀀스
    setTimeout(()=>addLog('O8','자가복구 시도: 우회 경로 후보 계산','info'), 600);
    setTimeout(()=>addLog('D12','지역 단위 수렴: 대체 경로 승인','info'), 1200);
    setTimeout(()=>addLog('I20','글로벌 재조정: 재배치 명령 하향 전달','success'), 1800);
    setTimeout(()=>{
      setLinks(prev=>prev.map(l=>
        l.state==='fault'?{...l,state:'reroute'}:l
      ));
      addLog('O8','우회 경로 활성화 완료 (reroute-active)','success');
      setHcWave(null);
    }, 2400);
  },[nodes, addLog]);

  // ─── 슬립 모드 ───────────────────────────────────────────────────
  const handleSleepMode = useCallback(()=>{
    const lowUsage=nodes.filter(n=>n.layer<=1&&n.state==='active'&&(n.usage||0)<0.25);
    if(!lowUsage.length){ addLog('VELSA','슬립 조건 미충족: 저부하 노드 없음','warn'); return; }

    const targets=lowUsage.slice(0,Math.min(3,lowUsage.length));
    setNodes(prev=>prev.map(n=>targets.some(t=>t.id===n.id)?{...n,state:'sleep'}:n));

    targets.forEach(t=>{
      addLog(LAYER_META[t.layer].key, `슬립 모드 진입: ${t.name.slice(-8)} (사용률 ${((t.usage||0)*100).toFixed(0)}%)`, 'warn');
    });
    addLog('O8','우회 경로 재설계: 슬립 노드 제외','info');
    setTimeout(()=>addLog('D12','슬립 모드 전파 완료: 에너지 최적화','success'), 800);
  },[nodes, addLog]);

  // ─── 슬립 복귀 ───────────────────────────────────────────────────
  const handleWakeUp = useCallback(()=>{
    const sleeping=nodes.filter(n=>n.state==='sleep');
    if(!sleeping.length){ addLog('VELSA','슬립 상태 노드 없음','warn'); return; }
    setNodes(prev=>prev.map(n=>n.state==='sleep'?{...n,state:'active',usage:0.3}:n));
    addLog('O8','자동 복귀: 사용량 임계치 복원 감지','info');
    setTimeout(()=>addLog('D12','원래 E2E 경로 재활성화 완료','success'), 600);
  },[nodes, addLog]);

  // ─── 소버린 정책 발동 ────────────────────────────────────────────
  const handleSovereign = useCallback(()=>{
    setSovereignAlert({ ts:Date.now(), msg:'국가 단위 긴급 정책 발동: 트래픽 재배치 명령' });
    addLog('I20','소버린 정책 발동: 국가 단위 재난 대응 모드','error');

    // I20 → D12 → O8 파티클 발사
    const i20=nodes.find(n=>n.layer===4);
    const d12s=nodes.filter(n=>n.layer===3&&n.state==='active');
    const o8s=nodes.filter(n=>n.layer===2&&n.state==='active');

    if(i20){
      d12s.forEach(d=>setTimeout(()=>firePacket(i20.id,d.id,C.SOVEREIGN,7), 200));
      o8s.forEach((o,i)=>setTimeout(()=>firePacket(d12s[0]?.id||i20.id,o.id,C.SOVEREIGN,5), 600+i*60));
    }

    setTimeout(()=>addLog('D12','소버린 명령 수신: 지역 재배치 실행','warn'), 500);
    setTimeout(()=>addLog('O8','도시 단위 정책 적용 완료','success'), 1000);
    setTimeout(()=>setSovereignAlert(null), 3000);
  },[nodes, firePacket, addLog]);

  // ─── 장애 복구 ───────────────────────────────────────────────────
  const handleRestore = useCallback(()=>{
    setNodes(prev=>prev.map(n=>n.state==='fault'?{...n,state:'active',usage:0.4}:n));
    setLinks(prev=>prev.map(l=>l.state==='fault'||l.state==='reroute'?{...l,state:'ok'}:l));
    setE2ePaths([]);
    addLog('SYSTEM','전체 복구 완료: 모든 노드/링크 정상화','success');
  },[addLog]);

  // ─── 노드 클릭 ───────────────────────────────────────────────────
  const handleNodeClick = useCallback((n)=>{
    setSelected(prev=>prev?.id===n.id?null:n);
  },[]);

  // ─── SVG 렌더 ────────────────────────────────────────────────────
  const linkColor = l=>{
    if(l.state==='fault') return C.FAULT;
    if(l.state==='reroute') return C.REROUTE;
    if(l.type==='hypercube') return 'rgba(41,121,255,0.35)';
    if(l.type==='sovereign') return 'rgba(170,0,255,0.5)';
    if(l.type==='vertical')  return 'rgba(0,200,83,0.4)';
    return 'rgba(255,255,255,0.12)';
  };
  const linkWidth = l=>{
    if(l.state==='fault') return 2;
    if(l.state==='reroute') return 2.5;
    if(l.type==='hypercube') return 1;
    if(l.type==='sovereign') return 1.5;
    return 1;
  };
  const linkDash = l=>{
    if(l.state==='reroute') return '6 3';
    if(l.type==='hypercube') return '3 4';
    return 'none';
  };
  const nodeColor = n=>{
    if(n.state==='fault') return C.FAULT;
    if(n.state==='sleep') return C.SLEEP;
    return LAYER_META[n.layer]?.color||'#fff';
  };
  const nodeOpacity = n=> n.state==='sleep'?0.35:1;
  const usageColor = u=> u>0.8?'#FF1744':u>0.6?'#FF9800':'#00C853';

  // 하이퍼큐브 웨이브 링
  const hcRings = hcWave ? (() => {
    const origin=nodeMap[hcWave.origin];
    if(!origin) return null;
    const elapsed=(Date.now()-hcWave.ts)/1000;
    return [0,1,2].map(i=>{
      const r=60+(elapsed*120+i*50);
      const op=Math.max(0,0.6-elapsed*0.3-i*0.15);
      return <circle key={i} cx={origin.x} cy={origin.y} r={r} fill="none" stroke={C.HCPROP} strokeWidth={1.5} opacity={op}/>;
    });
  })():null;

  return (
    <div style={{ fontFamily:"'JetBrains Mono','Fira Code',monospace", background:C.BG, color:C.TEXT, minHeight:'100vh', display:'flex', flexDirection:'column' }}>

      {/* ── 헤더 ── */}
      <div style={{ padding:'12px 24px', borderBottom:'1px solid rgba(255,255,255,0.07)', display:'flex', alignItems:'center', justifyContent:'space-between', background:'rgba(0,0,0,0.4)' }}>
        <div>
          <span style={{ fontSize:18, fontWeight:700, letterSpacing:3, color:'#fff' }}>VELSA</span>
          <span style={{ fontSize:11, color:'#607080', marginLeft:12 }}>Network AI Simulator v4.0 · {REGION}</span>
        </div>
        <div style={{ display:'flex', gap:20, fontSize:11 }}>
          {[
            { label:'Active', val:stats.activeNodes, color:'#00C853' },
            { label:'Sleep',  val:stats.sleepNodes,  color:'#607080' },
            { label:'Fault',  val:stats.faultNodes,  color:C.FAULT },
            { label:'E2E',    val:stats.e2eCount,     color:C.E2E },
            { label:'Reroute',val:stats.rerouteCount, color:C.REROUTE },
          ].map(s=>(
            <div key={s.label} style={{ textAlign:'center' }}>
              <div style={{ fontSize:18, fontWeight:700, color:s.color }}>{s.val}</div>
              <div style={{ color:'#607080' }}>{s.label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* ── 컨트롤 바 ── */}
      <div style={{ padding:'10px 24px', display:'flex', gap:10, borderBottom:'1px solid rgba(255,255,255,0.05)', flexWrap:'wrap', alignItems:'center' }}>
        {[
          { label:'⟶ E2E 요청',    fn:handleE2ERequest, color:'#E040FB' },
          { label:'⚡ 장애 주입',   fn:handleFaultInject, color:C.FAULT },
          { label:'💤 슬립 모드',   fn:handleSleepMode,   color:'#607080' },
          { label:'↑ 웨이크업',     fn:handleWakeUp,       color:C.REROUTE },
          { label:'🛡 소버린 정책', fn:handleSovereign,    color:C.SOVEREIGN },
          { label:'✓ 전체 복구',    fn:handleRestore,      color:'#00C853' },
        ].map(b=>(
          <button key={b.label} onClick={b.fn}
            style={{ padding:'7px 16px', border:`1px solid ${b.color}40`, borderRadius:4, background:`${b.color}14`,
              color:b.color, cursor:'pointer', fontSize:11, letterSpacing:1, transition:'all .2s' }}
            onMouseEnter={e=>{ e.target.style.background=`${b.color}30`; }}
            onMouseLeave={e=>{ e.target.style.background=`${b.color}14`; }}>
            {b.label}
          </button>
        ))}
        <div style={{ marginLeft:'auto', fontSize:10, color:'#405060' }}>
          노드 클릭 → 상세 정보
        </div>
      </div>

      {/* ── 메인 영역 ── */}
      <div style={{ display:'flex', flex:1, overflow:'hidden' }}>

        {/* ── SVG 캔버스 ── */}
        <div style={{ flex:1, position:'relative', overflow:'hidden' }}>

          {/* 소버린 경보 오버레이 */}
          {sovereignAlert && (
            <div style={{ position:'absolute', top:16, left:'50%', transform:'translateX(-50%)',
              padding:'10px 24px', background:'rgba(255,109,0,0.15)', border:'1px solid #FF6D00',
              borderRadius:6, fontSize:11, color:'#FF6D00', zIndex:10, letterSpacing:1, animation:'pulse 0.5s infinite alternate' }}>
              🛡 {sovereignAlert.msg}
            </div>
          )}

          <svg ref={svgRef} width="100%" height="100%" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMid meet"
            style={{ display:'block' }}>
            <defs>
              <filter id="glow">
                <feGaussianBlur stdDeviation="3" result="blur"/>
                <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
              </filter>
              <filter id="glowStrong">
                <feGaussianBlur stdDeviation="6" result="blur"/>
                <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
              </filter>
            </defs>

            {/* 배경 레이어 구분선 */}
            {LY.map((y,i)=>(
              <g key={i}>
                <line x1={0} y1={y-55} x2={W} y2={y-55} stroke="rgba(255,255,255,0.025)" strokeWidth={1}/>
                <text x={14} y={y+4} fill={LAYER_META[i].color} fontSize={9} opacity={0.5} letterSpacing={2}>
                  {LAYER_META[i].label}
                </text>
              </g>
            ))}

            {/* 링크 */}
            {links.map(l=>{
              const src=nodeMap[l.src], dst=nodeMap[l.dst];
              if(!src||!dst) return null;
              return (
                <line key={l.id}
                  x1={src.x} y1={src.y} x2={dst.x} y2={dst.y}
                  stroke={linkColor(l)} strokeWidth={linkWidth(l)}
                  strokeDasharray={linkDash(l)} opacity={l.state==='fault'?0.8:1}
                  filter={l.state==='reroute'?'url(#glow)':undefined}/>
              );
            })}

            {/* 하이퍼큐브 웨이브 */}
            {hcRings}

            {/* 패킷 */}
            {packets.map(p=>{
              const x=p.x1+(p.x2-p.x1)*p.progress;
              const y=p.y1+(p.y2-p.y1)*p.progress;
              return (
                <circle key={p.id} cx={x} cy={y} r={p.size} fill={p.color} opacity={0.9}
                  filter="url(#glow)"/>
              );
            })}

            {/* 노드 */}
            {nodes.map(n=>{
              const meta=LAYER_META[n.layer];
              const r=BR[n.layer];
              const col=nodeColor(n);
              const isSelected=selected?.id===n.id;
              const usage=n.usage||0;
              return (
                <g key={n.id} style={{ cursor:'pointer' }} onClick={()=>handleNodeClick(n)}>
                  {/* 사용량 링 */}
                  {n.layer>=1 && (
                    <circle cx={n.x} cy={n.y} r={r+4}
                      fill="none" stroke={usageColor(usage)} strokeWidth={1.5}
                      strokeDasharray={`${usage*(2*Math.PI*(r+4))} ${(1-usage)*(2*Math.PI*(r+4))}`}
                      strokeDashoffset={(2*Math.PI*(r+4))*0.25}
                      opacity={n.state==='sleep'?0.2:0.6}
                      transform={`rotate(-90, ${n.x}, ${n.y})`}/>
                  )}
                  {/* 선택 링 */}
                  {isSelected && (
                    <circle cx={n.x} cy={n.y} r={r+8} fill="none"
                      stroke="#fff" strokeWidth={1} opacity={0.6}/>
                  )}
                  {/* 노드 본체 */}
                  <circle cx={n.x} cy={n.y} r={r} fill={col} opacity={nodeOpacity(n)}
                    filter={n.state==='active'&&n.layer>=2?'url(#glow)':undefined}/>
                  {/* 장애 X */}
                  {n.state==='fault' && (
                    <g>
                      <line x1={n.x-r*.6} y1={n.y-r*.6} x2={n.x+r*.6} y2={n.y+r*.6} stroke="#fff" strokeWidth={1.5}/>
                      <line x1={n.x+r*.6} y1={n.y-r*.6} x2={n.x-r*.6} y2={n.y+r*.6} stroke="#fff" strokeWidth={1.5}/>
                    </g>
                  )}
                  {/* 슬립 z */}
                  {n.state==='sleep' && (
                    <text x={n.x} y={n.y+3} textAnchor="middle" fontSize={8} fill="#90A4AE" fontWeight={700}>z</text>
                  )}
                  {/* AI 레이블 */}
                  {meta.ai && n.layer>=2 && (
                    <text x={n.x} y={n.y+3} textAnchor="middle" fontSize={6} fill="#000" fontWeight={700} opacity={0.8}>
                      {meta.ai}
                    </text>
                  )}
                </g>
              );
            })}
          </svg>
        </div>

        {/* ── 사이드 패널 ── */}
        <div style={{ width:280, borderLeft:'1px solid rgba(255,255,255,0.06)', display:'flex', flexDirection:'column', overflow:'hidden' }}>

          {/* 선택 노드 상세 */}
          {selected && (
            <div style={{ padding:'14px 16px', borderBottom:'1px solid rgba(255,255,255,0.06)', background:'rgba(255,255,255,0.02)' }}>
              <div style={{ fontSize:10, color:'#607080', letterSpacing:2, marginBottom:8 }}>NODE DETAIL</div>
              <div style={{ fontSize:11, color:nodeColor(selected), fontWeight:700, marginBottom:4 }}>
                {selected.name}
              </div>
              <div style={{ fontSize:10, color:'#607080' }}>{LAYER_META[selected.layer].desc}</div>
              <div style={{ marginTop:10, display:'grid', gridTemplateColumns:'1fr 1fr', gap:6, fontSize:10 }}>
                {[
                  { k:'Layer',   v:LAYER_META[selected.layer].key },
                  { k:'State',   v:selected.state?.toUpperCase() },
                  { k:'Usage',   v:`${((selected.usage||0)*100).toFixed(0)}%` },
                  { k:'Sovereign',v:selected.sovereign||'—' },
                  { k:'HC Coord', v:selected.hcCoord||'—' },
                  { k:'AI Agent', v:LAYER_META[selected.layer].ai||'—' },
                ].map(({k,v})=>(
                  <div key={k}>
                    <div style={{ color:'#405060', marginBottom:2 }}>{k}</div>
                    <div style={{ color:'#E0E8FF' }}>{v}</div>
                  </div>
                ))}
              </div>
              {selected.layer===0 && selected.parentH6 && (
                <div style={{ marginTop:8, fontSize:10, color:'#607080' }}>
                  Parent: {nodeMap[selected.parentH6]?.name?.slice(-10)}
                </div>
              )}
            </div>
          )}

          {/* 범례 */}
          <div style={{ padding:'12px 16px', borderBottom:'1px solid rgba(255,255,255,0.05)' }}>
            <div style={{ fontSize:9, color:'#405060', letterSpacing:2, marginBottom:8 }}>LEGEND</div>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:4, fontSize:9 }}>
              {[
                { color:C.E2E,      label:'E2E 패킷' },
                { color:C.REROUTE,  label:'우회 경로' },
                { color:C.HCPROP,   label:'HC 전파' },
                { color:C.SOVEREIGN,label:'소버린 명령' },
                { color:C.FAULT,    label:'장애' },
                { color:C.SLEEP,    label:'슬립 모드' },
              ].map(l=>(
                <div key={l.label} style={{ display:'flex', alignItems:'center', gap:5 }}>
                  <div style={{ width:8, height:8, borderRadius:'50%', background:l.color }}/>
                  <span style={{ color:'#607080' }}>{l.label}</span>
                </div>
              ))}
            </div>
          </div>

          {/* 이벤트 로그 */}
          <div style={{ flex:1, overflow:'hidden', display:'flex', flexDirection:'column' }}>
            <div style={{ padding:'10px 16px 6px', fontSize:9, color:'#405060', letterSpacing:2, borderBottom:'1px solid rgba(255,255,255,0.04)' }}>
              EVENT LOG
            </div>
            <div style={{ flex:1, overflowY:'auto', padding:'6px 0' }}>
              {logs.map(l=>(
                <div key={l.id} style={{ padding:'4px 16px', borderBottom:'1px solid rgba(255,255,255,0.02)', fontSize:9 }}>
                  <div style={{ display:'flex', justifyContent:'space-between', marginBottom:2 }}>
                    <span style={{ color:
                      l.layer==='I20'?C.I20:l.layer==='D12'?C.D12:l.layer==='O8'?C.O8:
                      l.layer==='VELSA'?'#FF6D00':'#607080', fontWeight:700 }}>
                      [{l.layer}]
                    </span>
                    <span style={{ color:'#304050' }}>
                      {new Date(l.ts).toLocaleTimeString('ko-KR',{hour12:false,hour:'2-digit',minute:'2-digit',second:'2-digit'})}
                    </span>
                  </div>
                  <div style={{ color:
                    l.type==='error'?'#EF5350':l.type==='warn'?'#FF9800':
                    l.type==='success'?'#66BB6A':'#90A4AE' }}>
                    {l.msg}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* ── 하단 레이어 설명 ── */}
      <div style={{ padding:'8px 24px', borderTop:'1px solid rgba(255,255,255,0.05)', display:'flex', gap:24, fontSize:9, color:'#405060' }}>
        {LAYER_META.map(m=>(
          <div key={m.key} style={{ display:'flex', alignItems:'center', gap:6 }}>
            <div style={{ width:8, height:8, borderRadius:'50%', background:m.color }}/>
            <span>{m.label}</span>
            {m.ai && <span style={{ color:m.color, opacity:0.7 }}>· {m.ai}</span>}
          </div>
        ))}
        <div style={{ marginLeft:'auto' }}>
          T4→H6→O8→D12→I20 · 하이퍼큐브 좌표 기반 수평 전파 · 소버린 정책 연계
        </div>
      </div>

      <style>{`
        @keyframes pulse { from { opacity: 0.8; } to { opacity: 1; } }
        ::-webkit-scrollbar { width: 4px; } 
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.1); border-radius: 2px; }
      `}</style>
    </div>
  );
}
