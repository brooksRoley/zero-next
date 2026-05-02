import { useState, useEffect, useRef, useCallback, useMemo } from "react";

// ─── Board Size Schemas ──────────────────────────────────────────────────────
// Each schema defines grid dimensions, cell size, and difficulty character.
// Smaller boards = tighter placement puzzles. Larger = more strategic depth.
// The "density" ratio (path_length / placeable_cells) controls difficulty feel.
const BOARD_SCHEMAS = [
  { id:"compact",  label:"Compact",  cols:12, rows:8,  cell:52, waves:12, desc:"Tight puzzle, quick games",    startGold:90,  lives:12 },
  { id:"standard", label:"Standard", cols:16, rows:8,  cell:50, waves:16, desc:"Balanced strategy",            startGold:110, lives:15 },
  { id:"wide",     label:"Wide",     cols:20, rows:8,  cell:48, waves:20, desc:"Classic TD, full tactics",     startGold:120, lives:15 },
  { id:"grand",    label:"Grand",    cols:24, rows:10, cell:44, waves:24, desc:"Marathon, deep investment",     startGold:140, lives:18 },
  { id:"tower",    label:"Tower",    cols:10, rows:14, cell:46, waves:18, desc:"Vertical gauntlet, tight bends",startGold:100, lives:12 },
];

const FOREST=0,ROAD=1,OBSTACLE=2;
const SELL_REFUND=0.7;

// ─── Tower Tiers ─────────────────────────────────────────────────────────────
const TIERS=[
  {id:"apprentice",name:"Apprentice",cost:20,baseDmg:10,range:2.0,cooldown:800,splash:0.2,slow:0,desc:"Cheap all-rounder",hueBase:210,color:"#7eb8ff",tip:"Versatile starter. Works anywhere — place along straight roads for steady coverage."},
  {id:"pyromancer",name:"Pyromancer",cost:60,baseDmg:18,range:2.0,cooldown:1000,splash:0.9,slow:0,desc:"Area damage",hueBase:10,color:"#d14624",tip:"Big splash radius but short range. Best at tight corners and U-turns where ants cluster together."},
  {id:"frostclaw",name:"Frostclaw",cost:50,baseDmg:7,range:3.5,cooldown:600,splash:0.2,slow:800,desc:"Slows, fast",hueBase:190,color:"#55ddff",tip:"Long range + slow effect. Place near long straight sections so other towers get more hits on slowed ants."},
  {id:"archsage",name:"Archsage",cost:100,baseDmg:40,range:3.0,cooldown:1700,splash:1.2,slow:0,desc:"Devastating",hueBase:55,color:"#ffdd44",tip:"Slow but devastating splash. Place at bends where the path loops back — the range can cover two lanes at once."},
];

const upgradeCost=(tier,lvl)=>Math.floor(tier.cost*0.5*Math.pow(lvl,1.4));
const towerDmg=(tier,lvl)=>Math.floor(tier.baseDmg*(1+0.4*Math.log(lvl+1)));
const towerDPS=(tier,lvl)=>towerDmg(tier,lvl)/(tier.cooldown/1000);

// ─── Scaling ─────────────────────────────────────────────────────────────────
const antHp=w=>Math.floor(40*Math.pow(w,1.55));
const waveSize=w=>6+Math.floor(w*1.8);
const spawnInterval=w=>Math.max(300,1400-w*55);
const antSpeed=w=>0.012*(1+(w-1)*0.02);
const killReward=w=>Math.floor(5+w*0.8);
const waveBonus=w=>20+w*5;

// ─── Helpers ─────────────────────────────────────────────────────────────────
function dist(a,b){return Math.sqrt((a.col-b.col)**2+(a.row-b.row)**2);}
function lerpPath(path,t){const i=Math.min(Math.floor(t),path.length-2),f=t-i;const a=path[i],b=path[Math.min(i+1,path.length-1)];return{row:a.row+(b.row-a.row)*f,col:a.col+(b.col-a.col)*f};}
function sRng(seed){let s=seed;return()=>{s=(s*16807)%2147483647;return(s-1)/2147483646;};}

function analyzeBalance(wave,towers,cell){
  const totalHp=antHp(wave)*waveSize(wave);const speed=antSpeed(wave);let totalDps=0;
  for(const t of towers){const tier=TIERS[t.tierIdx];const dps=towerDPS(tier,t.level);const exp=(tier.range*2*cell)/(speed*cell/0.016)*60;totalDps+=dps*Math.min(exp,8);}
  const ratio=towers.length>0?totalDps/(totalHp/10):0;
  return{totalHp,totalDps:Math.floor(totalDps),ratio:Math.round(ratio*100)/100};
}

// ─── Map Templates (parameterized by cols/rows) ─────────────────────────────
function wpToPath(waypoints){
  const path=[],vis=new Set();
  for(let w=0;w<waypoints.length-1;w++){let{row:r,col:c}=waypoints[w];const{row:tr,col:tc}=waypoints[w+1];while(r!==tr||c!==tc){const k=`${r},${c}`;if(!vis.has(k)){path.push({row:r,col:c});vis.add(k);}if(c!==tc)c+=c<tc?1:-1;else if(r!==tr)r+=r<tr?1:-1;}}
  const last=waypoints[waypoints.length-1],lk=`${last.row},${last.col}`;if(!vis.has(lk))path.push(last);return path;
}

// Maps are functions of (grid, cols, rows) — they adapt to any board size
const MAP_TEMPLATES=[
  {name:"S-Curve",fn(g,C,R){
    const m=Math.floor(C/4),b=R-2;
    const wp=[{row:1,col:0},{row:1,col:m},{row:b,col:m},{row:b,col:m*2},{row:1,col:m*2},{row:1,col:m*3},{row:b,col:m*3},{row:b,col:C-1}];
    const p=wpToPath(wp);
    [[0,m-2],[0,m-1],[R-1,m-2],[R-1,m-1],[0,m*2+1],[R-1,m*2+1]].forEach(([r,c])=>{if(r>=0&&r<R&&c>=0&&c<C&&!p.some(q=>q.row===r&&q.col===c))g[r][c]=OBSTACLE;});
    return p;
  }},
  {name:"Zigzag",fn(g,C,R){
    const s=Math.floor(C/5),b=R-2;
    const wp=[{row:1,col:0},{row:1,col:s},{row:b,col:s},{row:b,col:s*2},{row:1,col:s*2},{row:1,col:s*3},{row:b,col:s*3},{row:b,col:s*4},{row:Math.floor(R/2),col:s*4},{row:Math.floor(R/2),col:C-1}];
    const p=wpToPath(wp);
    for(let i=1;i<=4;i++){const c=s*i;[0,R-1].forEach(r=>{if(c-1>=0&&c-1<C&&!p.some(q=>q.row===r&&q.col===c-1))g[r][c-1]=OBSTACLE;});}
    return p;
  }},
  {name:"Spiral",fn(g,C,R){
    const wp=[{row:0,col:0},{row:0,col:C-4},{row:R-1,col:C-4},{row:R-1,col:3},{row:2,col:3},{row:2,col:C-7},{row:R-3,col:C-7},{row:R-3,col:Math.floor(C/2)},{row:Math.floor(R/2),col:Math.floor(C/2)},{row:Math.floor(R/2),col:C-1}];
    const p=wpToPath(wp.filter(w=>w.col>=0&&w.col<C&&w.row>=0&&w.row<R));
    [[1,1],[R-2,1],[1,C-2],[R-2,C-2]].forEach(([r,c])=>{if(r>=0&&r<R&&c>=0&&c<C&&!p.some(q=>q.row===r&&q.col===c))g[r][c]=OBSTACLE;});
    return p;
  }},
  {name:"Switchback",fn(g,C,R){
    const gap=Math.max(3,Math.floor(C/6)),b=R-2;const wp=[{row:1,col:0}];
    let row=1,dir=1;
    for(let c=gap;c<C-1;c+=gap){const nr=dir>0?b:1;wp.push({row,col:c},{row:nr,col:c});row=nr;dir*=-1;}
    wp.push({row,col:C-1});
    const p=wpToPath(wp);
    for(let c=gap;c<C-1;c+=gap)for(let r=2;r<R-2;r++){if(!p.some(q=>q.row===r&&q.col===c-1))g[r][c-1]=OBSTACLE;}
    return p;
  }},
  {name:"Diamond",fn(g,C,R){
    const mid=Math.floor(R/2),q1=Math.floor(C/4),q3=Math.floor(C*3/4);
    const wp=[{row:mid,col:0},{row:mid,col:q1},{row:1,col:Math.floor(C/3)},{row:1,col:Math.floor(C/2)},{row:mid,col:Math.floor(C*0.6)},{row:R-2,col:q3},{row:R-2,col:q3+2},{row:mid,col:C-3},{row:mid,col:C-1}];
    const p=wpToPath(wp.filter(w=>w.col>=0&&w.col<C&&w.row>=0&&w.row<R));
    [[0,q1],[R-1,q1],[0,q3],[R-1,q3]].forEach(([r,c])=>{if(r>=0&&r<R&&c>=0&&c<C&&!p.some(q=>q.row===r&&q.col===c))g[r][c]=OBSTACLE;});
    return p;
  }},
  {name:"U-Turn",fn(g,C,R){
    const mid=Math.floor(C/2),b=R-1;
    const wp=[{row:1,col:0},{row:1,col:mid},{row:b,col:mid},{row:b,col:2},{row:Math.floor(R/2),col:2},{row:Math.floor(R/2),col:mid+2},{row:1,col:mid+2},{row:1,col:C-1}];
    const p=wpToPath(wp.filter(w=>w.col>=0&&w.col<C&&w.row>=0&&w.row<R));
    [[0,Math.floor(mid/2)],[0,mid+Math.floor(mid/2)]].forEach(([r,c])=>{if(r>=0&&r<R&&c>=0&&c<C&&!p.some(q=>q.row===r&&q.col===c))g[r][c]=OBSTACLE;});
    return p;
  }},
];

function generateMap(mi,cols,rows){
  const grid=Array.from({length:rows},()=>Array(cols).fill(FOREST));
  const idx=mi%MAP_TEMPLATES.length;
  const path=MAP_TEMPLATES[idx].fn(grid,cols,rows);
  for(const p of path)if(p.row>=0&&p.row<rows&&p.col>=0&&p.col<cols)grid[p.row][p.col]=ROAD;
  return{grid,path};
}

// ─── Terrain Cache ───────────────────────────────────────────────────────────
function buildTerrainCache(grid,seedGrid,cols,rows,cell){
  const c=document.createElement("canvas");c.width=cols*cell;c.height=rows*cell;
  const ctx=c.getContext("2d");
  for(let r=0;r<rows;r++)for(let co=0;co<cols;co++){
    const x=co*cell,y=r*cell,tile=grid[r][co],seed=seedGrid[r][co];
    if(tile===ROAD)drawRoad(ctx,x,y,cell,seed,{up:r>0&&grid[r-1][co]===ROAD,down:r<rows-1&&grid[r+1][co]===ROAD,left:co>0&&grid[r][co-1]===ROAD,right:co<cols-1&&grid[r][co+1]===ROAD});
    else if(tile===OBSTACLE)drawObstacle(ctx,x,y,cell,seed);
    else drawForestStatic(ctx,x,y,cell,seed);
    ctx.strokeStyle=tile===FOREST?"rgba(100,180,60,0.12)":"rgba(0,0,0,0.06)";ctx.strokeRect(x,y,cell,cell);
  }
  return c;
}

// ─── Drawing (static terrain — no time-based animation for cache) ────────────
function drawForestStatic(ctx,x,y,s,seed){
  const rng=sRng(seed),row=Math.floor(y/s),col=Math.floor(x/s),ck=(row+col)%2===0?8:0;
  ctx.fillStyle=`rgb(${50+rng()*20+ck|0},${120+rng()*30+ck|0},${40+rng()*15+ck|0})`;ctx.fillRect(x,y,s,s);
  ctx.strokeStyle="rgba(120,200,80,0.18)";ctx.lineWidth=1;ctx.strokeRect(x+2,y+2,s-4,s-4);
  ctx.strokeStyle="rgba(80,170,60,0.45)";ctx.lineWidth=1;
  for(let i=0;i<3;i++){const bx=x+10+rng()*(s-20),by=y+s-6;ctx.beginPath();ctx.moveTo(bx,by);ctx.quadraticCurveTo(bx,by-10-rng()*6,bx+2,by-14-rng()*4);ctx.stroke();}
  if(rng()>0.65){const fx=x+8+rng()*(s-16),fy=y+6+rng()*(s-16),fh=(seed*137)%360;ctx.fillStyle=`hsl(${fh},75%,72%)`;for(let p=0;p<4;p++){const a=(p/4)*Math.PI*2;ctx.beginPath();ctx.arc(fx+Math.cos(a)*2.5,fy+Math.sin(a)*2.5,1.8,0,Math.PI*2);ctx.fill();}ctx.fillStyle="#ffe066";ctx.beginPath();ctx.arc(fx,fy,1.2,0,Math.PI*2);ctx.fill();}
}

function drawRoad(ctx,x,y,s,seed,nb){
  const rng=sRng(seed);ctx.fillStyle="#8a7d6b";ctx.fillRect(x,y,s,s);ctx.fillStyle="#7e725e";ctx.fillRect(x+2,y+2,s-4,s-4);
  ctx.strokeStyle="rgba(60,50,35,0.25)";ctx.lineWidth=1;const stW=s/3,stH=s/2;for(let sr=0;sr<2;sr++){const oX=sr%2===0?0:stW*0.5;for(let sc=-1;sc<4;sc++)ctx.strokeRect(x+sc*stW+oX+1,y+sr*stH+1,stW-2,stH-2);}
  ctx.strokeStyle="rgba(100,90,65,0.3)";ctx.lineWidth=2;ctx.setLineDash([6,4]);
  if(nb.left||nb.right){ctx.beginPath();ctx.moveTo(x,y+s/2);ctx.lineTo(x+s,y+s/2);ctx.stroke();}
  if(nb.up||nb.down){ctx.beginPath();ctx.moveTo(x+s/2,y);ctx.lineTo(x+s/2,y+s);ctx.stroke();}ctx.setLineDash([]);
  ctx.fillStyle="rgba(70,120,45,0.35)";
  if(!nb.up)for(let i=0;i<4;i++){ctx.beginPath();ctx.ellipse(x+4+rng()*(s-8),y+3,3+rng()*2,2,0,0,Math.PI*2);ctx.fill();}
  if(!nb.down)for(let i=0;i<4;i++){ctx.beginPath();ctx.ellipse(x+4+rng()*(s-8),y+s-3,3+rng()*2,2,0,0,Math.PI*2);ctx.fill();}
  if(!nb.left)for(let i=0;i<3;i++){ctx.beginPath();ctx.ellipse(x+3,y+4+rng()*(s-8),2,3+rng()*2,0,0,Math.PI*2);ctx.fill();}
  if(!nb.right)for(let i=0;i<3;i++){ctx.beginPath();ctx.ellipse(x+s-3,y+4+rng()*(s-8),2,3+rng()*2,0,0,Math.PI*2);ctx.fill();}
}

function drawObstacle(ctx,x,y,s,seed){
  ctx.fillStyle="#3a3530";ctx.fillRect(x,y,s,s);const cx=x+s/2,cy=y+s/2;
  const rg=ctx.createRadialGradient(cx-5,cy-5,3,cx,cy,s*0.42);rg.addColorStop(0,"#777");rg.addColorStop(0.5,"#5a5550");rg.addColorStop(1,"#3a3530");ctx.fillStyle=rg;
  ctx.beginPath();ctx.moveTo(cx-s*0.35,cy+s*0.2);ctx.lineTo(cx-s*0.3,cy-s*0.25);ctx.lineTo(cx-s*0.05,cy-s*0.35);ctx.lineTo(cx+s*0.25,cy-s*0.28);ctx.lineTo(cx+s*0.38,cy);ctx.lineTo(cx+s*0.3,cy+s*0.25);ctx.lineTo(cx-s*0.1,cy+s*0.32);ctx.closePath();ctx.fill();
  ctx.strokeStyle="rgba(20,18,15,0.4)";ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(cx-6,cy-4);ctx.lineTo(cx+1,cy+5);ctx.stroke();
  ctx.strokeStyle="rgba(180,50,50,0.18)";ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(cx-6,cy-6);ctx.lineTo(cx+6,cy+6);ctx.moveTo(cx+6,cy-6);ctx.lineTo(cx-6,cy+6);ctx.stroke();
}

// ─── Tier Visual Configs ─────────────────────────────────────────────────────
// Each tier gets a completely distinct look: body color, hat style, wand type
const TIER_VIS={
  apprentice:{body:"#e8c88a",bodyDk:"#c9a060",outline:"#6b5a3a",hat:"#4a5a8a",hatDk:"#3a4670",hatAccent:"#8899cc",hatDeco:"stars",wand:"#6b5a3a",star:"#ffcc44",starGlow:"#fff4aa"},
  pyromancer:{body:"#f0f0f0",bodyDk:"#d0c8e0",outline:"#5544aa",hat:"#7744cc",hatDk:"#5533aa",hatAccent:"#aa77ee",hatDeco:"dots",wand:"#553322",star:"#ff8833",starGlow:"#ffcc66"},
  frostclaw:{body:"#2a2a2a",bodyDk:"#1a1a1a",outline:"#111",hat:"#2255cc",hatDk:"#1a3d99",hatAccent:"#44aaff",hatDeco:"stars",wand:"#334",star:"#66ddff",starGlow:"#aaeeff"},
  archsage:{body:"#f5e6d0",bodyDk:"#d4b896",outline:"#6b4422",hat:"#cc4444",hatDk:"#993322",hatAccent:"#ff8855",hatDeco:"moons",wand:"#442211",star:"#ffd700",starGlow:"#fff8cc"},
};

// ─── Sprite Drawing (reference-inspired chibi cat wizards) ───────────────────
function drawCat(ctx,x,y,size,state,time,hue,tierId,level){
  const s=size,atk=state==="attack";
  const v=TIER_VIS[tierId]||TIER_VIS.apprentice;
  const bounce=Math.sin(time*0.003)*2;
  const squash=atk?0.95:1; // slight squash on attack
  const atkPop=atk?Math.sin(time*0.02)*1.5:0;
  ctx.save();
  ctx.translate(x,y+bounce);
  ctx.scale(squash,2-squash); // squash-stretch

  const ol=s*0.02; // outline thickness factor

  // ── Shadow ──
  ctx.fillStyle="rgba(0,0,0,0.12)";
  ctx.beginPath();ctx.ellipse(0,s*0.38,s*0.28,s*0.06,0,0,Math.PI*2);ctx.fill();

  // ── Body (round bean shape like references) ──
  // Outline first
  ctx.fillStyle=v.outline;
  ctx.beginPath();ctx.ellipse(0,s*0.12,s*0.28+ol,s*0.3+ol,0,0,Math.PI*2);ctx.fill();
  // Body fill with gradient
  const bG=ctx.createRadialGradient(-s*0.06,-s*0.02,s*0.05,0,s*0.12,s*0.32);
  bG.addColorStop(0,v.body);bG.addColorStop(1,v.bodyDk);
  ctx.fillStyle=bG;
  ctx.beginPath();ctx.ellipse(0,s*0.12,s*0.28,s*0.3,0,0,Math.PI*2);ctx.fill();

  // Belly highlight (lighter oval on front)
  ctx.fillStyle="rgba(255,255,255,0.15)";
  ctx.beginPath();ctx.ellipse(0,s*0.15,s*0.16,s*0.18,0,0,Math.PI*2);ctx.fill();

  // ── Arm stubs (little paws reaching out) ──
  const armWave=Math.sin(time*0.005)*0.1;
  for(const sd of[-1,1]){
    ctx.fillStyle=v.outline;
    ctx.beginPath();ctx.ellipse(sd*s*0.26,s*0.05+sd*atkPop,s*0.09+ol,s*0.065+ol,sd*0.3+armWave,0,Math.PI*2);ctx.fill();
    ctx.fillStyle=v.body;
    ctx.beginPath();ctx.ellipse(sd*s*0.26,s*0.05+sd*atkPop,s*0.09,s*0.065,sd*0.3+armWave,0,Math.PI*2);ctx.fill();
  }

  // ── Feet stubs ──
  for(const sd of[-1,1]){
    ctx.fillStyle=v.outline;
    ctx.beginPath();ctx.ellipse(sd*s*0.12,s*0.38,s*0.1+ol,s*0.055+ol,0,0,Math.PI*2);ctx.fill();
    ctx.fillStyle=v.body;
    ctx.beginPath();ctx.ellipse(sd*s*0.12,s*0.38,s*0.1,s*0.055,0,0,Math.PI*2);ctx.fill();
  }

  // ── Head (big round, overlapping body like references) ──
  const hy=-s*0.2;
  ctx.fillStyle=v.outline;
  ctx.beginPath();ctx.arc(0,hy,s*0.24+ol,0,Math.PI*2);ctx.fill();
  const hG=ctx.createRadialGradient(-s*0.05,hy-s*0.05,s*0.03,0,hy,s*0.26);
  hG.addColorStop(0,v.body);hG.addColorStop(1,v.bodyDk);
  ctx.fillStyle=hG;
  ctx.beginPath();ctx.arc(0,hy,s*0.24,0,Math.PI*2);ctx.fill();

  // Face highlight
  ctx.fillStyle="rgba(255,255,240,0.12)";
  ctx.beginPath();ctx.ellipse(-s*0.03,hy-s*0.04,s*0.14,s*0.12,0,0,Math.PI*2);ctx.fill();

  // ── Ears (triangular with inner color) ──
  for(const sd of[-1,1]){
    // Outer ear
    ctx.fillStyle=v.outline;
    ctx.beginPath();
    ctx.moveTo(sd*s*0.15,hy-s*0.18);
    ctx.lineTo(sd*s*0.24,hy-s*0.42);
    ctx.lineTo(sd*s*0.04,hy-s*0.24);
    ctx.closePath();ctx.fill();
    // Inner ear fill
    ctx.fillStyle=v.body;
    ctx.beginPath();
    ctx.moveTo(sd*s*0.15,hy-s*0.19);
    ctx.lineTo(sd*s*0.22,hy-s*0.38);
    ctx.lineTo(sd*s*0.06,hy-s*0.24);
    ctx.closePath();ctx.fill();
    // Inner pink
    ctx.fillStyle="rgba(220,160,160,0.4)";
    ctx.beginPath();
    ctx.moveTo(sd*s*0.14,hy-s*0.2);
    ctx.lineTo(sd*s*0.2,hy-s*0.34);
    ctx.lineTo(sd*s*0.08,hy-s*0.24);
    ctx.closePath();ctx.fill();
  }

  // ── Wizard Hat ──
  const hatTop=tierId==="archsage"?hy-s*0.7:hy-s*0.58;
  // Hat brim outline + fill
  ctx.fillStyle=v.outline;
  ctx.beginPath();ctx.ellipse(0,hy-s*0.18,s*0.3+ol,s*0.07+ol,0,0,Math.PI*2);ctx.fill();
  ctx.fillStyle=v.hatDk;
  ctx.beginPath();ctx.ellipse(0,hy-s*0.18,s*0.3,s*0.07,0,0,Math.PI*2);ctx.fill();
  // Hat cone outline
  const lean=Math.sin(time*0.0025)*s*0.02;
  ctx.fillStyle=v.outline;
  ctx.beginPath();ctx.moveTo(-s*0.22-ol,hy-s*0.18);ctx.quadraticCurveTo(lean,hatTop-s*0.04,s*0.04+lean,hatTop-ol);ctx.lineTo(s*0.22+ol,hy-s*0.18);ctx.closePath();ctx.fill();
  // Hat cone fill
  const htG=ctx.createLinearGradient(0,hatTop,0,hy-s*0.1);
  htG.addColorStop(0,v.hat);htG.addColorStop(1,v.hatDk);
  ctx.fillStyle=htG;
  ctx.beginPath();ctx.moveTo(-s*0.22,hy-s*0.18);ctx.quadraticCurveTo(lean,hatTop-s*0.02,s*0.04+lean,hatTop);ctx.lineTo(s*0.22,hy-s*0.18);ctx.closePath();ctx.fill();
  // Hat band
  ctx.fillStyle=v.hatAccent;
  ctx.beginPath();ctx.ellipse(0,hy-s*0.18,s*0.26,s*0.04,0,0,Math.PI*2);ctx.fill();

  // Hat decorations
  if(v.hatDeco==="stars"){
    ctx.fillStyle=v.hatAccent;
    const starPositions=[[0.02,-0.35],[0.08,-0.28],[-0.06,-0.3]];
    for(const[sx,sy]of starPositions){drawMiniStar(ctx,lean*0.5+s*sx,hy+s*sy,s*0.03,time);}
  }else if(v.hatDeco==="dots"){
    ctx.fillStyle="rgba(255,255,255,0.4)";
    const dotPos=[[0.02,-0.33],[0.1,-0.26],[-0.04,-0.28],[0.06,-0.22],[-0.08,-0.22],[0.12,-0.32]];
    for(const[dx,dy]of dotPos){ctx.beginPath();ctx.arc(lean*0.4+s*dx,hy+s*dy,s*0.018,0,Math.PI*2);ctx.fill();}
  }else if(v.hatDeco==="moons"){
    ctx.fillStyle=v.hatAccent;
    drawMiniMoon(ctx,lean*0.5+s*0.03,hy-s*0.32,s*0.04);
    drawMiniStar(ctx,lean*0.3-s*0.06,hy-s*0.26,s*0.025,time);
  }

  // ── Eyes ──
  const blink=Math.floor(time/2500)%8===0&&(time%2500)<120;
  const eyeY=hy+s*0.02;
  if(!blink){
    // White
    ctx.fillStyle="#fff";
    ctx.beginPath();ctx.ellipse(-s*0.08,eyeY,s*0.06,s*0.065,0,0,Math.PI*2);ctx.fill();
    ctx.beginPath();ctx.ellipse(s*0.08,eyeY,s*0.06,s*0.065,0,0,Math.PI*2);ctx.fill();
    // Pupil
    const pOff=atk?0.01:0;
    ctx.fillStyle=atk?"#cc2200":"#222";
    ctx.beginPath();ctx.arc(-s*0.07+s*pOff,eyeY+s*0.01,s*0.035,0,Math.PI*2);ctx.fill();
    ctx.beginPath();ctx.arc(s*0.09+s*pOff,eyeY+s*0.01,s*0.035,0,Math.PI*2);ctx.fill();
    // Highlight
    ctx.fillStyle="#fff";
    ctx.beginPath();ctx.arc(-s*0.08,eyeY-s*0.015,s*0.015,0,Math.PI*2);ctx.fill();
    ctx.beginPath();ctx.arc(s*0.08,eyeY-s*0.015,s*0.015,0,Math.PI*2);ctx.fill();
    // Glow on attack
    if(atk){ctx.fillStyle="rgba(255,200,50,0.25)";ctx.beginPath();ctx.arc(-s*0.08,eyeY,s*0.09,0,Math.PI*2);ctx.fill();ctx.beginPath();ctx.arc(s*0.08,eyeY,s*0.09,0,Math.PI*2);ctx.fill();}
  }else{
    ctx.strokeStyle=v.outline;ctx.lineWidth=s*0.02;
    ctx.beginPath();ctx.moveTo(-s*0.11,eyeY);ctx.lineTo(-s*0.05,eyeY);ctx.stroke();
    ctx.beginPath();ctx.moveTo(s*0.05,eyeY);ctx.lineTo(s*0.11,eyeY);ctx.stroke();
  }

  // ── Nose (tiny triangle) ──
  ctx.fillStyle="#d49090";
  ctx.beginPath();ctx.moveTo(0,hy+s*0.09);ctx.lineTo(-s*0.02,hy+s*0.12);ctx.lineTo(s*0.02,hy+s*0.12);ctx.closePath();ctx.fill();
  // Mouth (w shape)
  ctx.strokeStyle=v.outline;ctx.lineWidth=s*0.012;
  ctx.beginPath();ctx.moveTo(-s*0.04,hy+s*0.14);ctx.quadraticCurveTo(-s*0.01,hy+s*0.17,0,hy+s*0.14);ctx.quadraticCurveTo(s*0.01,hy+s*0.17,s*0.04,hy+s*0.14);ctx.stroke();

  // ── Wand (held in right paw, angled up-right) ──
  const wandAngle=atk?-0.5+Math.sin(time*0.02)*0.3:-0.8;
  const wandLen=s*0.38;
  const wx=s*0.22,wy=s*0.02;
  ctx.save();ctx.translate(wx,wy);ctx.rotate(wandAngle);
  // Wand stick
  ctx.strokeStyle=v.wand;ctx.lineWidth=s*0.04;ctx.lineCap="round";
  ctx.beginPath();ctx.moveTo(0,0);ctx.lineTo(0,-wandLen);ctx.stroke();
  // Star on tip
  const starS=atk?s*0.1:s*0.07+Math.sin(time*0.005)*s*0.01;
  // Star glow
  const sg=ctx.createRadialGradient(0,-wandLen,0,0,-wandLen,starS*2.5);
  sg.addColorStop(0,v.starGlow+"cc");sg.addColorStop(0.5,v.starGlow+"44");sg.addColorStop(1,"rgba(255,255,200,0)");
  ctx.fillStyle=sg;ctx.beginPath();ctx.arc(0,-wandLen,starS*2.5,0,Math.PI*2);ctx.fill();
  // Star shape
  drawStar(ctx,0,-wandLen,starS,5,v.star,v.starGlow);
  // Sparkle trail on attack
  if(atk){
    for(let i=0;i<3;i++){
      const sp=Math.sin(time*0.015+i*2)*s*0.08;
      const sy=-wandLen-s*0.06-i*s*0.06;
      ctx.fillStyle=`${v.star}${Math.floor((1-i*0.3)*200).toString(16).padStart(2,'0')}`;
      drawMiniStar(ctx,sp,sy,s*0.025*(1-i*0.2),time+i*500);
    }
  }
  ctx.restore();

  // ── Level Badge ──
  if(level>1){
    ctx.fillStyle="rgba(0,0,0,0.6)";ctx.beginPath();ctx.arc(-s*0.28,s*0.3,s*0.1,0,Math.PI*2);ctx.fill();
    ctx.strokeStyle="rgba(255,215,0,0.6)";ctx.lineWidth=1.5;ctx.beginPath();ctx.arc(-s*0.28,s*0.3,s*0.1,0,Math.PI*2);ctx.stroke();
    ctx.fillStyle="#ffd700";ctx.font=`bold ${s*0.11}px sans-serif`;ctx.textAlign="center";ctx.textBaseline="middle";
    ctx.fillText(level,-s*0.28,s*0.31);
  }

  ctx.restore();
}

// ── Helper: draw a 5-point star ──
function drawStar(ctx,cx,cy,r,points,fill,glow){
  ctx.fillStyle=fill;ctx.beginPath();
  for(let i=0;i<points*2;i++){
    const a=i*Math.PI/points-Math.PI/2;
    const rd=i%2===0?r:r*0.45;
    const px=cx+Math.cos(a)*rd,py=cy+Math.sin(a)*rd;
    if(i===0)ctx.moveTo(px,py);else ctx.lineTo(px,py);
  }
  ctx.closePath();ctx.fill();
  // Center bright dot
  ctx.fillStyle=glow;ctx.beginPath();ctx.arc(cx,cy,r*0.3,0,Math.PI*2);ctx.fill();
}

function drawMiniStar(ctx,cx,cy,r,time){
  const rot=time*0.002;
  ctx.save();ctx.translate(cx,cy);ctx.rotate(rot);
  ctx.beginPath();
  for(let i=0;i<8;i++){const a=i*Math.PI/4,rd=i%2===0?r:r*0.4;
    const px=Math.cos(a)*rd,py=Math.sin(a)*rd;
    if(i===0)ctx.moveTo(px,py);else ctx.lineTo(px,py);}
  ctx.closePath();ctx.fill();ctx.restore();
}

function drawMiniMoon(ctx,cx,cy,r){
  // Crescent moon via two overlapping arcs
  ctx.beginPath();ctx.arc(cx,cy,r,0,Math.PI*2);ctx.fill();
  // Cut out with hat color to create crescent
  ctx.fillStyle="rgba(0,0,0,0.5)";
  ctx.beginPath();ctx.arc(cx+r*0.35,cy-r*0.25,r*0.7,0,Math.PI*2);ctx.fill();
}

// ── Range indicator: highlight actual grid cells within range ──
function drawRangeIndicator(ctx,col,row,range,C,gridRows,gridCols,color){
  const cx=col+0.5,cy=row+0.5;
  for(let r=0;r<gridRows;r++)for(let c=0;c<gridCols;c++){
    const dx=c+0.5-cx,dy=r+0.5-cy;
    if(Math.sqrt(dx*dx+dy*dy)<=range){
      ctx.fillStyle=color;
      ctx.fillRect(c*C,r*C,C,C);
    }
  }
}

function drawAnt(ctx,x,y,size,hp,maxHp,time,variant){
  const s=size,walk=Math.sin(time*0.012+variant)*2;ctx.save();ctx.translate(x,y);
  ctx.fillStyle="rgba(0,0,0,0.15)";ctx.beginPath();ctx.ellipse(0,s*0.25,s*0.2,s*0.04,0,0,Math.PI*2);ctx.fill();
  ctx.strokeStyle="#1a0a00";ctx.lineWidth=1.2;for(let i=-1;i<=1;i++){const lp=walk+i*1.2,lx=i*s*0.1;ctx.beginPath();ctx.moveTo(lx-s*0.05,s*0.04);ctx.lineTo(lx-s*0.18,s*0.16+Math.sin(lp)*2);ctx.stroke();ctx.beginPath();ctx.moveTo(lx+s*0.05,s*0.04);ctx.lineTo(lx+s*0.18,s*0.16+Math.cos(lp)*2);ctx.stroke();}
  const bc=hp/maxHp>0.5?"#3d1a00":hp/maxHp>0.25?"#6a2200":"#8b0000";ctx.fillStyle=bc;
  ctx.beginPath();ctx.ellipse(0,s*0.06,s*0.12,s*0.09,0,0,Math.PI*2);ctx.fill();ctx.beginPath();ctx.ellipse(s*0.08,s*0.01,s*0.07,s*0.06,0.3,0,Math.PI*2);ctx.fill();
  ctx.fillStyle="#2a0e00";ctx.beginPath();ctx.arc(s*0.16,-s*0.03,s*0.055,0,Math.PI*2);ctx.fill();
  ctx.fillStyle="#ff3300";ctx.beginPath();ctx.arc(s*0.18,-s*0.04,s*0.015,0,Math.PI*2);ctx.fill();
  const bw=s*0.4,bh=2.5,by=-s*0.22;ctx.fillStyle="rgba(0,0,0,0.5)";ctx.fillRect(-bw/2,by,bw,bh);
  const pct=Math.max(0,hp/maxHp);ctx.fillStyle=pct>0.5?"#44ff44":pct>0.25?"#ffcc00":"#ff3333";ctx.fillRect(-bw/2,by,bw*pct,bh);
  ctx.restore();
}

function drawBolt(ctx,x,y,hue,big){const r=big?14:9;const gl=ctx.createRadialGradient(x,y,0,x,y,r);gl.addColorStop(0,`hsla(${hue},100%,90%,0.9)`);gl.addColorStop(0.5,`hsla(${hue},100%,60%,0.4)`);gl.addColorStop(1,"rgba(255,255,200,0)");ctx.fillStyle=gl;ctx.beginPath();ctx.arc(x,y,r,0,Math.PI*2);ctx.fill();}

// ─── Component ───────────────────────────────────────────────────────────────
export default function NanuPikaAdventures(){
  const canvasRef=useRef(null),gameRef=useRef(null),frameRef=useRef(null),terrainRef=useRef(null),previewCellRef=useRef(null);
  const containerRef=useRef(null);
  const [boardIdx,setBoardIdx]=useState(2); // default "wide"
  const [selectedTier,setSelectedTier]=useState(0);
  const [selTower,setSelTower]=useState(null);
  const [started,setStarted]=useState(false);
  const [ui,setUi]=useState({gold:0,lives:0,wave:1,phase:"prep",antsLeft:0,score:0,towerCount:0,mapName:"",balance:null,maxWaves:20});
  const [canvasScale,setCanvasScale]=useState(1);
  const [activeTooltip,setActiveTooltip]=useState(null);
  const [activeTierTip,setActiveTierTip]=useState(null);
  const [gameSpeed,setGameSpeed]=useState(1);
  const gameSpeedRef=useRef(1);
  useEffect(()=>{gameSpeedRef.current=gameSpeed;},[gameSpeed]);
  const waveSnapshotRef=useRef(null);
  const footerRef=useRef(null);

  // Snapshot of game state at the start of the current wave — used for "Retry Wave"
  // so that towers, gold, lives and score restore to exactly what you had before this wave began.
  const snapshotWave=(g)=>{
    if(!g)return;
    waveSnapshotRef.current={
      wave:g.wave,
      gold:g.gold,
      lives:g.lives,
      score:g.score,
      towers:g.towers.map(t=>({...t,state:"idle",attackTimer:0,lastFired:0})),
    };
  };

  const schema=BOARD_SCHEMAS[boardIdx];
  const cW=schema.cols*schema.cell, cH=schema.rows*schema.cell;

  // Responsive scaling
  useEffect(()=>{
    function resize(){
      const footerH=footerRef.current?.offsetHeight||160;
      const maxW=Math.min(window.innerWidth-16, 1440);
      const maxH=window.innerHeight-footerH-8;
      const scale=Math.min(maxW/cW, maxH/cH, 1.2);
      setCanvasScale(scale);
    }
    resize();window.addEventListener("resize",resize);return()=>window.removeEventListener("resize",resize);
  },[cW,cH]);

  const initGame=useCallback((mi)=>{
    const s=BOARD_SCHEMAS[boardIdx];
    const idx=mi!=null?mi:Math.floor(Math.random()*MAP_TEMPLATES.length);
    const{grid,path}=generateMap(idx,s.cols,s.rows);
    const seedGrid=Array.from({length:s.rows},(_,r)=>Array.from({length:s.cols},(_,c)=>r*s.cols+c+idx*997+42));
    terrainRef.current=buildTerrainCache(grid,seedGrid,s.cols,s.rows,s.cell);
    gameRef.current={grid,path,cols:s.cols,rows:s.rows,cell:s.cell,towers:[],ants:[],projectiles:[],particles:[],gold:s.startGold,lives:s.lives,wave:1,phase:"prep",score:0,spawnTimer:0,spawned:0,ws:waveSize(1),lastTick:performance.now(),gameTime:0,seedGrid,hoverCell:null,maxWaves:s.waves};
    snapshotWave(gameRef.current);
    setSelTower(null);previewCellRef.current=null;setUi({gold:s.startGold,lives:s.lives,wave:1,phase:"prep",antsLeft:waveSize(1),score:0,towerCount:0,mapName:MAP_TEMPLATES[idx].name,balance:null,maxWaves:s.waves});
  },[boardIdx]);

  // Retry the current wave from the snapshot taken when the wave began.
  // Restores towers, gold, lives and score — works mid-wave and on game over.
  const retryWave=useCallback(()=>{
    const g=gameRef.current;const snap=waveSnapshotRef.current;
    if(!g||!snap)return;
    g.towers=snap.towers.map(t=>({...t,state:"idle",attackTimer:0,lastFired:0}));
    g.gold=snap.gold;g.lives=snap.lives;g.score=snap.score;g.wave=snap.wave;
    g.ants=[];g.projectiles=[];g.particles=[];
    g.phase="prep";g.spawned=0;g.spawnTimer=0;g.ws=waveSize(g.wave);g.hoverCell=null;g.gameTime=0;
    for(const t of g.towers)t.lastFired=0;
    setSelTower(null);previewCellRef.current=null;
    setUi(s=>({...s,gold:g.gold,lives:g.lives,wave:g.wave,score:g.score,phase:"prep",antsLeft:g.ws,towerCount:g.towers.length,balance:null}));
  },[]);

  const placeTower=useCallback((row,col)=>{const g=gameRef.current;if(!g||g.phase==="gameover"||g.phase==="victory")return false;if(g.grid[row][col]!==FOREST||g.towers.some(t=>t.row===row&&t.col===col))return false;const tier=TIERS[selectedTier];if(g.gold<tier.cost)return false;g.gold-=tier.cost;g.towers.push({row,col,tierId:tier.id,tierIdx:selectedTier,level:1,range:tier.range,cooldown:tier.cooldown,splash:tier.splash,slow:tier.slow,lastFired:0,state:"idle",attackTimer:0,id:Date.now()+Math.random(),hue:tier.hueBase+Math.floor(Math.random()*30-15)});setUi(s=>({...s,gold:g.gold,towerCount:g.towers.length}));return true;},[selectedTier]);

  const upgradeTower=useCallback((row,col)=>{const g=gameRef.current;if(!g)return;const t=g.towers.find(t=>t.row===row&&t.col===col);if(!t)return;const tier=TIERS[t.tierIdx];const cost=upgradeCost(tier,t.level);if(g.gold<cost)return;g.gold-=cost;t.level++;setSelTower({row,col,level:t.level,tierId:t.tierId,tierIdx:t.tierIdx});setUi(s=>({...s,gold:g.gold}));},[]);

  const sellTower=useCallback((row,col)=>{const g=gameRef.current;if(!g||g.phase==="wave")return;const idx=g.towers.findIndex(t=>t.row===row&&t.col===col);if(idx===-1)return;const t=g.towers[idx],tier=TIERS[t.tierIdx];let inv=tier.cost;for(let l=1;l<t.level;l++)inv+=upgradeCost(tier,l);g.gold+=Math.floor(inv*SELL_REFUND);g.towers.splice(idx,1);setSelTower(null);setUi(s=>({...s,gold:g.gold,towerCount:g.towers.length}));},[]);

  const startWave=useCallback(()=>{const g=gameRef.current;if(!g||g.phase!=="prep")return;g.phase="wave";g.spawned=0;g.spawnTimer=0;g.ants=[];g.projectiles=[];g.hoverCell=null;setSelTower(null);previewCellRef.current=null;setUi(s=>({...s,phase:"wave",balance:analyzeBalance(g.wave,g.towers,g.cell)}));},[]);

  const getGridPos=useCallback((e)=>{
    const canvas=canvasRef.current,g=gameRef.current;if(!canvas||!g)return null;
    const rect=canvas.getBoundingClientRect();
    const clientX=e.touches?e.touches[0].clientX:e.clientX;
    const clientY=e.touches?e.touches[0].clientY:e.clientY;
    const col=Math.floor((clientX-rect.left)*(canvas.width/rect.width)/g.cell);
    const row=Math.floor((clientY-rect.top)*(canvas.height/rect.height)/g.cell);
    if(row>=0&&row<g.rows&&col>=0&&col<g.cols)return{row,col};return null;
  },[]);

  const handleClick=useCallback((e)=>{const pos=getGridPos(e);if(!pos)return;const g=gameRef.current;if(!g)return;const existing=g.towers.find(t=>t.row===pos.row&&t.col===pos.col);if(existing){setSelTower({...pos,level:existing.level,tierId:existing.tierId,tierIdx:existing.tierIdx});return;}if(placeTower(pos.row,pos.col))setSelTower(null);},[getGridPos,placeTower]);
  const handleRightClick=useCallback((e)=>{e.preventDefault();const pos=getGridPos(e);if(pos)sellTower(pos.row,pos.col);},[getGridPos,sellTower]);
  const handleMove=useCallback((e)=>{const pos=getGridPos(e);if(gameRef.current)gameRef.current.hoverCell=pos;},[getGridPos]);
  const handleTouchStart=useCallback((e)=>{
    e.preventDefault();const pos=getGridPos(e);const g=gameRef.current;
    if(!pos||!g||g.phase==="gameover"||g.phase==="victory"){previewCellRef.current=null;if(g)g.hoverCell=null;return;}
    // Tap existing tower → select it
    const existing=g.towers.find(t=>t.row===pos.row&&t.col===pos.col);
    if(existing){setSelTower({...pos,level:existing.level,tierId:existing.tierId,tierIdx:existing.tierIdx});previewCellRef.current=null;g.hoverCell=null;return;}
    const tier=TIERS[selectedTier];const canPlace=g.grid[pos.row][pos.col]===FOREST&&!g.towers.some(t=>t.row===pos.row&&t.col===pos.col)&&g.gold>=tier.cost;
    if(!canPlace){previewCellRef.current=null;g.hoverCell=null;setSelTower(null);return;}
    const prev=previewCellRef.current;
    // Second tap on same cell → confirm placement
    if(prev&&prev.row===pos.row&&prev.col===pos.col){if(placeTower(pos.row,pos.col))setSelTower(null);previewCellRef.current=null;g.hoverCell=null;return;}
    // First tap or different cell → show preview with range
    previewCellRef.current=pos;g.hoverCell=pos;setSelTower(null);
  },[getGridPos,placeTower,selectedTier]);

  // ─── Game Loop ─────────────────────────────────────────────────────────────
  useEffect(()=>{
    if(!started)return;
    const canvas=canvasRef.current;if(!canvas)return;const ctx=canvas.getContext("2d");
    function tick(now){
      const g=gameRef.current;if(!g){frameRef.current=requestAnimationFrame(tick);return;}
      const realDt=Math.min(now-g.lastTick,100);g.lastTick=now;
      const dt=realDt*gameSpeedRef.current;
      g.gameTime=(g.gameTime||0)+dt;
      const C=g.cell;
      if(g.phase==="wave"){
        g.spawnTimer-=dt;if(g.spawnTimer<=0&&g.spawned<g.ws){g.spawnTimer=spawnInterval(g.wave);g.ants.push({t:0,hp:antHp(g.wave),maxHp:antHp(g.wave),id:now+Math.random(),speed:antSpeed(g.wave)*(0.85+Math.random()*0.3),dead:false,deathTime:0,variant:Math.random()*100,slow:0});g.spawned++;}
        for(const ant of g.ants){if(ant.dead){ant.deathTime+=dt;continue;}ant.t+=ant.speed*(ant.slow>0?0.5:1)*(dt/16);if(ant.slow>0)ant.slow-=dt;if(ant.t>=g.path.length-1){ant.dead=true;ant.deathTime=999;g.lives=Math.max(0,g.lives-1);}}
        for(const tower of g.towers){if(tower.state==="attack"){tower.attackTimer+=dt;if(tower.attackTimer>300){tower.state="idle";}continue;}if(g.gameTime-tower.lastFired<tower.cooldown)continue;const tier=TIERS[tower.tierIdx];const dmg=towerDmg(tier,tower.level);let closest=null,cDist=Infinity;for(const ant of g.ants){if(ant.dead)continue;const pos=lerpPath(g.path,ant.t);const d=dist(pos,tower);if(d<=tower.range&&d<cDist){closest=ant;cDist=d;}}
        if(closest){tower.lastFired=g.gameTime;tower.state="attack";tower.attackTimer=0;const pos=lerpPath(g.path,closest.t);const hitX=pos.col*C+C/2,hitY=pos.row*C+C/2;g.projectiles.push({sx:tower.col*C+C/2,sy:tower.row*C+C/2,tx:hitX,ty:hitY,t:0,hue:tower.hue,big:tower.splash>0});closest.hp-=dmg;if(tower.slow)closest.slow=tower.slow;
        if(tower.splash>0){for(const a2 of g.ants){if(a2.dead||a2===closest)continue;const p2=lerpPath(g.path,a2.t);const dx=(p2.col-pos.col)*C,dy=(p2.row-pos.row)*C;if(Math.sqrt(dx*dx+dy*dy)<tower.splash*C){a2.hp-=Math.floor(dmg*0.5);if(a2.hp<=0&&!a2.dead){a2.dead=true;a2.deathTime=0;g.gold+=killReward(g.wave);g.score+=10+g.wave*3;}}}}
        for(let i=0;i<5;i++){const a=Math.random()*Math.PI*2,sp=1+Math.random()*2.5;g.particles.push({x:hitX,y:hitY,vx:Math.cos(a)*sp,vy:Math.sin(a)*sp,life:350,maxLife:350,size:2+Math.random()*2,hue:closest.hp<=0?0:tower.hue+60,type:closest.hp<=0?"death":"hit"});}
        if(closest.hp<=0&&!closest.dead){closest.dead=true;closest.deathTime=0;g.gold+=killReward(g.wave);g.score+=10+g.wave*3;for(let i=0;i<8;i++){const a=(i/8)*Math.PI*2;g.particles.push({x:hitX,y:hitY,vx:Math.cos(a)*2,vy:Math.sin(a)*2,life:500,maxLife:500,size:2.5,hue:30,type:"death"});}}}}
        for(const p of g.projectiles)p.t+=dt/140;g.projectiles=g.projectiles.filter(p=>p.t<1);
        for(const p of g.particles){p.x+=p.vx*(dt/16);p.y+=p.vy*(dt/16);p.vy+=0.04*(dt/16);p.life-=dt;}g.particles=g.particles.filter(p=>p.life>0);
        g.ants=g.ants.filter(a=>!(a.dead&&a.deathTime>500));
        if(g.spawned>=g.ws&&(g.ants.length===0||g.ants.every(a=>a.dead))){
          if(g.lives<=0){g.phase="gameover";setUi(s=>({...s,phase:"gameover",lives:0,gold:g.gold,score:g.score}));}
          else if(g.wave>=g.maxWaves){g.phase="victory";g.score+=g.lives*100+g.gold;setUi(s=>({...s,phase:"victory",gold:g.gold,score:g.score+g.lives*100+g.gold}));}
          else{g.wave++;g.gold+=waveBonus(g.wave-1);g.phase="prep";g.ws=waveSize(g.wave);g.ants=[];g.particles=[];g.projectiles=[];g.gameTime=0;for(const t of g.towers)t.lastFired=0;snapshotWave(g);setUi(s=>({...s,gold:g.gold,lives:g.lives,wave:g.wave,phase:"prep",antsLeft:g.ws,score:g.score,towerCount:g.towers.length,balance:null}));}
        }else{const alive=g.ants.filter(a=>!a.dead).length;setUi(s=>({...s,gold:g.gold,lives:g.lives,antsLeft:g.ws-g.spawned+alive,score:g.score}));}
      }
      // DRAW: terrain from cache
      const cw=g.cols*C,ch=g.rows*C;ctx.clearRect(0,0,cw,ch);
      if(terrainRef.current)ctx.drawImage(terrainRef.current,0,0);
      // Path arrows
      ctx.fillStyle="rgba(255,220,150,0.08)";for(let i=0;i<g.path.length-1;i+=3){const p=g.path[i],n=g.path[Math.min(i+1,g.path.length-1)];const dx=n.col-p.col,dy=n.row-p.row,cx2=p.col*C+C/2,cy2=p.row*C+C/2,angle=Math.atan2(dy,dx);ctx.save();ctx.translate(cx2,cy2);ctx.rotate(angle);ctx.beginPath();ctx.moveTo(7,0);ctx.lineTo(-3,-4);ctx.lineTo(-3,4);ctx.closePath();ctx.fill();ctx.restore();}
      // Hover + Range
      const tier=TIERS[selectedTier];
      if(g.hoverCell&&g.phase!=="gameover"&&g.phase!=="victory"){const{row:hr,col:hc}=g.hoverCell;const hasTower=g.towers.some(t=>t.row===hr&&t.col===hc);const canPlace=g.grid[hr][hc]===FOREST&&!hasTower&&g.gold>=tier.cost;
        ctx.fillStyle=hasTower?"rgba(255,200,50,0.15)":canPlace?"rgba(100,255,100,0.2)":"rgba(255,60,60,0.08)";ctx.fillRect(hc*C,hr*C,C,C);
        if(canPlace&&!hasTower){
          drawRangeIndicator(ctx,hc,hr,tier.range,C,g.rows,g.cols,`${tier.color}18`);
          ctx.strokeStyle=`${tier.color}55`;ctx.lineWidth=1.5;ctx.setLineDash([4,4]);ctx.beginPath();ctx.arc(hc*C+C/2,hr*C+C/2,tier.range*C,0,Math.PI*2);ctx.stroke();ctx.setLineDash([]);
          ctx.globalAlpha=0.3;drawCat(ctx,hc*C+C/2,hr*C+C/2+4,C*0.7,"idle",now,tier.hueBase,tier.id,1);ctx.globalAlpha=1;
        }}
      if(selTower){const t=g.towers.find(t=>t.row===selTower.row&&t.col===selTower.col);if(t){
        drawRangeIndicator(ctx,t.col,t.row,t.range,C,g.rows,g.cols,`${TIERS[t.tierIdx].color}15`);
        ctx.strokeStyle=TIERS[t.tierIdx].color;ctx.lineWidth=2;ctx.strokeRect(t.col*C+1,t.row*C+1,C-2,C-2);ctx.strokeStyle=`${TIERS[t.tierIdx].color}55`;ctx.lineWidth=1;ctx.beginPath();ctx.arc(t.col*C+C/2,t.row*C+C/2,t.range*C,0,Math.PI*2);ctx.stroke();}}
      // Projectiles
      for(const p of g.projectiles){const ease=1-(1-p.t)*(1-p.t);const px=p.sx+(p.tx-p.sx)*ease,py=p.sy+(p.ty-p.sy)*ease-Math.sin(ease*Math.PI)*20;drawBolt(ctx,px,py,p.hue+60,p.big);}
      // Ants
      for(const ant of g.ants){if(ant.dead)continue;const pos=lerpPath(g.path,ant.t);if(ant.slow>0){ctx.fillStyle="rgba(100,200,255,0.12)";ctx.beginPath();ctx.arc(pos.col*C+C/2,pos.row*C+C/2,12,0,Math.PI*2);ctx.fill();}drawAnt(ctx,pos.col*C+C/2,pos.row*C+C/2,C*0.5,ant.hp,ant.maxHp,now,ant.variant);}
      // Towers
      for(const t of g.towers)drawCat(ctx,t.col*C+C/2,t.row*C+C/2+2,C*0.7,t.state==="attack"?"attack":"idle",now,t.hue,t.tierId,t.level);
      // Particles
      for(const p of g.particles){const a=p.life/p.maxLife;ctx.fillStyle=p.type==="death"?`hsla(${p.hue},90%,55%,${a})`:`hsla(${p.hue},100%,70%,${a})`;ctx.beginPath();ctx.arc(p.x,p.y,p.size*a,0,Math.PI*2);ctx.fill();}
      // End overlays
      if(g.phase==="gameover"||g.phase==="victory"){ctx.fillStyle="rgba(10,5,20,0.7)";ctx.fillRect(0,0,cw,ch);ctx.textAlign="center";ctx.textBaseline="middle";const fs=Math.min(48,C*1.2);ctx.fillStyle=g.phase==="victory"?"#ffd700":"#ff6b6b";ctx.font=`bold ${fs}px 'Trebuchet MS',sans-serif`;ctx.fillText(g.phase==="victory"?"Victory!":"Game Over!",cw/2,ch/2-fs*0.6);ctx.fillStyle="#e0d0b0";ctx.font=`${fs*0.45}px 'Trebuchet MS',sans-serif`;ctx.fillText(`Score: ${g.score}  ·  Wave ${g.wave}/${g.maxWaves}`,cw/2,ch/2+fs*0.2);}
      frameRef.current=requestAnimationFrame(tick);
    }
    frameRef.current=requestAnimationFrame(tick);return()=>cancelAnimationFrame(frameRef.current);
  },[started,selectedTier,selTower]);

  // ─── Derived state ─────────────────────────────────────────────────────────
  const g=gameRef.current;
  const selTD=selTower&&g?g.towers.find(t=>t.row===selTower.row&&t.col===selTower.col):null;
  const selTI=selTD?TIERS[selTD.tierIdx]:null;
  const upCost=selTD&&selTI?upgradeCost(selTI,selTD.level):0;
  const btn={padding:"6px 14px",fontSize:"12px",fontWeight:700,border:"none",borderRadius:"8px",cursor:"pointer"};

  // ─── Board Select Screen ───────────────────────────────────────────────────
  if(!started)return(
    <div style={{display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",background:"linear-gradient(160deg,#0d1117,#161b22,#1a2332)",minHeight:"100vh",fontFamily:"'Trebuchet MS',sans-serif",color:"#c9d1d9",padding:"20px",gap:"16px"}}>
      <h1 style={{fontSize:"28px",fontWeight:800,background:"linear-gradient(90deg,#ff7eb3,#ff9a56,#ffd700,#56ffa4)",backgroundSize:"200%",animation:"shimmer 4s ease-in-out infinite",WebkitBackgroundClip:"text",WebkitTextFillColor:"transparent"}}>Nanu &amp; Pika Adventures</h1>
      <p style={{color:"#888",fontSize:"14px",maxWidth:"400px",textAlign:"center"}}>Choose your battlefield. Smaller boards are tighter puzzles, larger boards reward strategic depth.</p>
      <div style={{display:"flex",gap:"10px",flexWrap:"wrap",justifyContent:"center",maxWidth:"600px"}}>
        {BOARD_SCHEMAS.map((s,i)=>(
          <button key={s.id} onClick={()=>{setBoardIdx(i);}} style={{
            padding:"12px 16px",background:i===boardIdx?"rgba(100,255,150,0.12)":"rgba(255,255,255,0.04)",
            border:i===boardIdx?"2px solid rgba(100,255,150,0.4)":"2px solid transparent",
            borderRadius:"10px",cursor:"pointer",minWidth:"140px",textAlign:"left",color:"#c9d1d9",transition:"all 0.15s"}}>
            <div style={{fontSize:"15px",fontWeight:700,color:i===boardIdx?"#56ffa4":"#aaa"}}>{s.label}</div>
            <div style={{fontSize:"11px",color:"#888"}}>{s.cols}×{s.rows} · {s.waves} waves</div>
            <div style={{fontSize:"10px",color:"#666",marginTop:"2px"}}>{s.desc}</div>
          </button>
        ))}
      </div>
      <button onClick={()=>{setStarted(true);setTimeout(()=>initGame(),50);}} style={{...btn,padding:"12px 36px",fontSize:"16px",background:"linear-gradient(135deg,#43e97b,#38f9d7)",color:"#0d1117",boxShadow:"0 2px 20px rgba(67,233,123,0.3)",marginTop:"8px"}}>
        Start Game
      </button>
      <style>{`@keyframes shimmer{0%{background-position:0% 50%}50%{background-position:100% 50%}100%{background-position:0% 50%}}`}</style>
    </div>
  );

  // ─── Game UI ───────────────────────────────────────────────────────────────
  // Stat chips use a letter glyph (first letter of the label) instead of an emoji
  // — readable on every device and keeps the chip the same size at every locale.
  const statChips=[
    {id:"gold", glyph:"G",label:"Gold", value:ui.gold,               color:"#ffd700",tooltip:"Earn gold by defeating ants and completing waves. Use it to place and upgrade towers."},
    {id:"lives",glyph:"L",label:"Lives",value:ui.lives,              color:"#ff6b6b",tooltip:"Lives remaining. Each ant that escapes costs one life. Reach zero and it's Game Over."},
    {id:"wave", glyph:"W",label:"Wave", value:`${ui.wave}/${ui.maxWaves}`,color:"#79c0ff",tooltip:"Current wave out of total. Ants get faster and tougher each wave. You earn a gold bonus between waves."},
    {id:"ants", glyph:"A",label:"Ants", value:ui.antsLeft,           color:"#c9a96e",tooltip:"Ants remaining in this wave (spawning + alive). Defeat them all to clear the wave."},
    {id:"score",glyph:"S",label:"Score",value:ui.score,              color:"#7ee87e",tooltip:"Score from kills and wave completions. Earn bonus points for remaining lives and gold at victory."},
  ];
  const cycleSpeed=()=>setGameSpeed(s=>s>=3?1:s+1);
  const speedLabel=`${gameSpeed}x Speed`;
  const speedColor=gameSpeed===1?"#aaa":gameSpeed===2?"#ffd66e":"#ff8c5a";
  const canRetry=!!waveSnapshotRef.current;
  return(
    <div ref={containerRef} onClick={()=>setActiveTooltip(null)} style={{display:"flex",flexDirection:"column",height:"100dvh",overflow:"hidden",background:"linear-gradient(160deg,#0d1117,#161b22,#1a2332)",fontFamily:"'Trebuchet MS',sans-serif",color:"#c9d1d9",userSelect:"none",touchAction:"manipulation"}}>

      {/* ── Canvas area (fills remaining space) ── */}
      <div style={{flex:1,display:"flex",alignItems:"center",justifyContent:"center",overflow:"hidden",minHeight:0}}>
        <canvas ref={canvasRef} width={cW} height={cH}
          onClick={handleClick} onMouseMove={handleMove} onContextMenu={handleRightClick}
          onTouchStart={handleTouchStart}
          style={{
            borderRadius:"10px",border:"2px solid rgba(255,255,255,0.08)",
            boxShadow:"0 4px 32px rgba(0,0,0,0.6)",cursor:"crosshair",
            width:cW*canvasScale,height:cH*canvasScale,
            maxWidth:"100%",touchAction:"none",display:"block",
          }}/>
      </div>

      {/* ── Footer: HUD + controls ── */}
      <div ref={footerRef} style={{flexShrink:0,padding:"5px 4px 6px",borderTop:"1px solid rgba(255,255,255,0.06)",background:"rgba(10,14,22,0.8)",display:"flex",flexDirection:"column",gap:"4px",alignItems:"center"}}>

        {/* HUD stat chips with tooltips */}
        <div style={{display:"flex",gap:"5px",alignItems:"stretch",flexWrap:"wrap",justifyContent:"center",maxWidth:"100%"}}>
          {statChips.map(chip=>(
            <div key={chip.id} style={{position:"relative"}}
              onMouseEnter={()=>setActiveTooltip(chip.id)}
              onMouseLeave={()=>setActiveTooltip(null)}
              onClick={(e)=>{e.stopPropagation();setActiveTooltip(v=>v===chip.id?null:chip.id);}}
            >
              <div style={{display:"flex",flexDirection:"column",alignItems:"center",padding:"4px 10px",background:"rgba(255,255,255,0.05)",border:`1px solid ${activeTooltip===chip.id?chip.color+"55":chip.color+"22"}`,borderRadius:"8px",minWidth:"52px",cursor:"help",transition:"border-color 0.15s"}}>
                <span style={{fontSize:"10px",lineHeight:1.3,fontWeight:800,letterSpacing:"0.06em",color:chip.color,opacity:0.85}}>{chip.glyph}</span>
                <span style={{fontSize:"16px",fontWeight:800,color:chip.color,lineHeight:1.1}}>{chip.value}</span>
                <span style={{fontSize:"8px",color:"#777",letterSpacing:"0.05em",textTransform:"uppercase",marginTop:"1px"}}>{chip.label}</span>
              </div>
              {activeTooltip===chip.id&&(
                <div style={{position:"absolute",bottom:"calc(100% + 8px)",left:"50%",transform:"translateX(-50%)",background:"rgba(12,18,28,0.98)",border:`1px solid ${chip.color}44`,borderRadius:"9px",padding:"9px 13px",fontSize:"11px",color:"#c9d1d9",zIndex:200,boxShadow:`0 6px 24px rgba(0,0,0,0.7)`,width:"180px",textAlign:"center",pointerEvents:"none"}}>
                  <div style={{fontWeight:700,color:chip.color,marginBottom:"5px",fontSize:"12px"}}>{chip.label}</div>
                  <div style={{lineHeight:1.5,color:"#aaa"}}>{chip.tooltip}</div>
                  <div style={{position:"absolute",top:"100%",left:"50%",transform:"translateX(-50%)",width:0,height:0,borderLeft:"5px solid transparent",borderRight:"5px solid transparent",borderTop:`5px solid ${chip.color}44`}}/>
                </div>
              )}
            </div>
          ))}
          <div style={{display:"flex",alignItems:"center",padding:"4px 8px",fontSize:"9px",color:"#555",letterSpacing:"0.04em"}}>{ui.mapName}</div>
        </div>

        {/* Selected tower upgrade */}
        {selTD&&selTI&&(
          <div style={{display:"flex",gap:"6px",alignItems:"center",justifyContent:"center",flexWrap:"wrap"}}>
            <div style={{padding:"4px 10px",fontSize:"9px",background:`${selTI.color}12`,border:`1px solid ${selTI.color}55`,borderRadius:"7px",display:"flex",gap:"8px",alignItems:"center"}}>
              <div style={{display:"flex",alignItems:"center",gap:"5px",fontSize:"11px",color:selTI.color,fontWeight:700}}>
                <span style={{display:"inline-block",width:"10px",height:"10px",borderRadius:"3px",background:selTI.color,boxShadow:`0 0 6px ${selTI.color}88`}} aria-hidden="true" />
                {selTI.name} · Lv.{selTD.level}
              </div>
              <div style={{color:"#aaa"}}>Dmg: <b style={{color:"#ddd"}}>{towerDmg(selTI,selTD.level)}</b> → <b style={{color:"#7f7"}}>{towerDmg(selTI,selTD.level+1)}</b></div>
              <div style={{display:"flex",gap:"3px"}}>
                <button
                  onClick={()=>upgradeTower(selTower.row,selTower.col)}
                  disabled={ui.gold<upCost}
                  title={ui.gold>=upCost?`Upgrade ${selTI.name} to Lv.${selTD.level+1} for ${upCost}g`:`Need ${upCost}g to upgrade (you have ${ui.gold}g)`}
                  style={{...btn,padding:"2px 8px",fontSize:"9px",background:ui.gold>=upCost?"linear-gradient(135deg,#43e97b,#38f9d7)":"#333",color:ui.gold>=upCost?"#0d1117":"#555"}}
                >Upgrade · {upCost}g</button>
                <button
                  onClick={()=>sellTower(selTower.row,selTower.col)}
                  disabled={ui.phase!=="prep"}
                  title={ui.phase==="prep"?`Sell this ${selTI.name} for a 70% gold refund`:"Selling is only available between waves"}
                  style={{...btn,padding:"2px 6px",fontSize:"9px",background:ui.phase==="prep"?"rgba(255,80,80,0.18)":"rgba(255,255,255,0.04)",color:ui.phase==="prep"?"#f88":"#555",cursor:ui.phase==="prep"?"pointer":"not-allowed"}}
                >Sell</button>
              </div>
            </div>
          </div>
        )}

        {/* Tier selector */}
        <div style={{display:"flex",gap:"4px",overflowX:"auto",maxWidth:"100%",WebkitOverflowScrolling:"touch",padding:"0 4px",alignItems:"stretch"}}>
          {TIERS.map((t,i)=>{
            const active=i===selectedTier,afford=ui.gold>=t.cost;
            return(<div key={t.id} style={{position:"relative",flexShrink:0}}>
              <button
                onClick={()=>{setSelectedTier(i);setSelTower(null);setActiveTierTip(v=>v===t.id?null:t.id);}}
                onMouseEnter={()=>setActiveTierTip(t.id)}
                onMouseLeave={()=>setActiveTierTip(null)}
                style={{
                padding:"4px 8px",fontSize:"10px",fontWeight:active?800:500,width:"100%",
                background:active?`linear-gradient(135deg,${t.color}30,${t.color}15)`:"rgba(255,255,255,0.04)",
                color:afford?t.color:"#555",border:active?`2px solid ${t.color}80`:"2px solid transparent",
                borderRadius:"7px",cursor:"pointer",minWidth:"88px",textAlign:"left",opacity:afford?1:0.6,
                transition:"all 0.15s"}}>
                <div style={{display:"flex",alignItems:"center",gap:"5px",fontSize:"12px",fontWeight:700}}>
                  <span style={{display:"inline-block",width:"10px",height:"10px",borderRadius:"3px",background:t.color,boxShadow:active?`0 0 6px ${t.color}aa`:"none",opacity:afford?1:0.4}} aria-hidden="true" />
                  {t.name}
                </div>
                <div style={{display:"flex",alignItems:"center",gap:"4px",fontSize:"8px",color:afford?"#888":"#444",marginTop:"1px",flexWrap:"wrap"}}>
                  <span>{t.cost}g · {t.baseDmg}dmg</span>
                  {t.splash>0&&<span style={{padding:"1px 4px",borderRadius:"3px",background:"rgba(255,120,80,0.18)",color:afford?"#f9a07a":"#555",fontWeight:700,letterSpacing:"0.04em"}}>AOE</span>}
                  {t.slow>0&&<span style={{padding:"1px 4px",borderRadius:"3px",background:"rgba(85,221,255,0.16)",color:afford?"#7be3ff":"#555",fontWeight:700,letterSpacing:"0.04em"}}>SLOW</span>}
                </div>
                <div style={{fontSize:"8px",color:afford?"#666":"#333",fontStyle:"italic",marginTop:"1px"}}>{t.desc}</div>
              </button>
              {activeTierTip===t.id&&(
                <div style={{position:"absolute",bottom:"calc(100% + 8px)",left:"50%",transform:"translateX(-50%)",background:"rgba(12,18,28,0.98)",border:`1px solid ${t.color}44`,borderRadius:"9px",padding:"10px 13px",fontSize:"11px",color:"#c9d1d9",zIndex:200,boxShadow:`0 6px 24px rgba(0,0,0,0.7)`,width:"210px",textAlign:"left",pointerEvents:"none"}}>
                  <div style={{display:"flex",alignItems:"center",gap:"6px",fontWeight:700,color:t.color,marginBottom:"6px",fontSize:"12px"}}>
                    <span style={{display:"inline-block",width:"10px",height:"10px",borderRadius:"3px",background:t.color,boxShadow:`0 0 6px ${t.color}aa`}} aria-hidden="true" />
                    {t.name}
                  </div>
                  <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"3px 10px",fontSize:"10px",color:"#aaa",marginBottom:"6px"}}>
                    <span>Damage: <b style={{color:"#ddd"}}>{t.baseDmg}</b></span>
                    <span>Range: <b style={{color:"#ddd"}}>{t.range}</b></span>
                    <span>Speed: <b style={{color:"#ddd"}}>{(1000/t.cooldown).toFixed(1)}/s</b></span>
                    <span>Cost: <b style={{color:"#ffd700"}}>{t.cost}g</b></span>
                    {t.splash>0&&<span>Splash: <b style={{color:"#f88"}}>{t.splash}</b></span>}
                    {t.slow>0&&<span>Slow: <b style={{color:"#55ddff"}}>{t.slow}ms</b></span>}
                  </div>
                  <div style={{fontSize:"10px",color:"#999",lineHeight:1.4,borderTop:"1px solid rgba(255,255,255,0.06)",paddingTop:"6px"}}>{t.tip}</div>
                  <div style={{position:"absolute",top:"100%",left:"50%",transform:"translateX(-50%)",width:0,height:0,borderLeft:"5px solid transparent",borderRight:"5px solid transparent",borderTop:`5px solid ${t.color}44`}}/>
                </div>
              )}
            </div>);
          })}
        </div>

        {/* Action buttons — every button has a visible label and a tooltip describing
            both what it does and what state you'll be in afterwards. */}
        <div style={{display:"flex",gap:"5px",flexWrap:"wrap",justifyContent:"center",alignItems:"center"}}>
          {ui.phase==="prep"&&(<>
            <button
              onClick={startWave}
              title={`Begin Wave ${ui.wave}. ${waveSize(ui.wave)} ants will spawn. Once it starts, you can't place towers until the wave ends.`}
              style={{...btn,background:"linear-gradient(135deg,#43e97b,#38f9d7)",color:"#0d1117",padding:"7px 18px"}}
            >Start Wave {ui.wave}</button>
            <button
              onClick={cycleSpeed}
              title={`Game speed (click to cycle 1x → 2x → 3x). Affects ant movement and tower fire rate equally — pure fast-forward.`}
              style={{...btn,background:gameSpeed===1?"rgba(255,255,255,0.06)":`${speedColor}1f`,border:`1px solid ${gameSpeed===1?"transparent":speedColor+"66"}`,color:speedColor,fontSize:"11px",padding:"6px 12px"}}
            >{speedLabel}</button>
            <button
              onClick={retryWave}
              disabled={!canRetry}
              title={canRetry?`Restart Wave ${ui.wave} from the start of this wave. Restores your towers, gold, lives and score to what they were when this wave began.`:"No wave snapshot yet."}
              style={{...btn,background:"rgba(255,255,255,0.08)",color:canRetry?"#ffd66e":"#555",fontSize:"11px",padding:"6px 12px",cursor:canRetry?"pointer":"not-allowed"}}
            >Restart Wave</button>
            <button
              onClick={()=>initGame()}
              title="Generate a fresh map layout and reset to Wave 1. You'll lose all your towers and progress."
              style={{...btn,background:"rgba(255,255,255,0.06)",color:"#888",fontSize:"11px",padding:"6px 12px"}}
            >New Layout</button>
            <button
              onClick={()=>{setStarted(false);}}
              title="Pick a different board size. Returns to the board-select screen and starts a new game."
              style={{...btn,background:"rgba(255,255,255,0.04)",color:"#888",fontSize:"11px",padding:"6px 12px"}}
            >Change Board</button>
          </>)}
          {ui.phase==="wave"&&(<>
            <div style={{padding:"5px 14px",fontSize:"11px",background:"rgba(255,100,100,0.06)",border:"1px solid rgba(255,100,100,0.18)",borderRadius:"8px",animation:"pulse 1.8s infinite",color:"#ff9999"}}>Wave {ui.wave} in progress · {ui.antsLeft} ants left</div>
            <button
              onClick={cycleSpeed}
              title={`Game speed (click to cycle 1x → 2x → 3x). Affects ant movement and tower fire rate equally — pure fast-forward.`}
              style={{...btn,background:gameSpeed===1?"rgba(255,255,255,0.06)":`${speedColor}1f`,border:`1px solid ${gameSpeed===1?"transparent":speedColor+"66"}`,color:speedColor,fontSize:"11px",padding:"6px 12px"}}
            >{speedLabel}</button>
            <button
              onClick={retryWave}
              title={`A minion got through? Restart Wave ${ui.wave} from the beginning. Your towers, gold, lives and score restore to what they were when this wave started.`}
              style={{...btn,background:"rgba(255,214,110,0.14)",border:"1px solid rgba(255,214,110,0.4)",color:"#ffd66e",fontSize:"11px",padding:"6px 12px"}}
            >Restart Wave</button>
          </>)}
          {(ui.phase==="gameover"||ui.phase==="victory")&&(<>
            {ui.phase==="gameover"&&<button
              onClick={retryWave}
              title={`Restart Wave ${ui.wave} from the start of this wave. Restores your towers, gold, lives and score to what they were when this wave began.`}
              style={{...btn,background:"linear-gradient(135deg,#f7971e,#ffd200)",color:"#0d1117",padding:"7px 18px"}}
            >Retry Wave {ui.wave}</button>}
            <button
              onClick={()=>initGame()}
              title="Generate a fresh map layout and reset to Wave 1 on the same board size."
              style={{...btn,background:"linear-gradient(135deg,#f093fb,#f5576c)",color:"#fff",padding:"7px 18px"}}
            >New Game</button>
            <button
              onClick={()=>setStarted(false)}
              title="Pick a different board size."
              style={{...btn,background:"rgba(255,255,255,0.06)",color:"#aaa",fontSize:"11px",padding:"6px 14px"}}
            >Change Board</button>
          </>)}
        </div>

        {/* Legend — touch + mouse + keyboard mental model */}
        <div style={{fontSize:"9px",color:"#444",display:"flex",gap:"10px",flexWrap:"wrap",justifyContent:"center"}}>
          <span style={{color:"#4a8040"}}>Click forest tile to place selected tower</span>
          <span style={{color:"#907040"}}>Click placed tower to select &amp; upgrade</span>
          <span style={{color:"#666"}}>Right-click a tower to sell (between waves)</span>
          <span style={{color:"#555"}}>{schema.label} · {schema.cols}×{schema.rows} · {ui.mapName}</span>
        </div>
      </div>

      <style>{`@keyframes pulse{0%,100%{opacity:1}50%{opacity:0.5}}@keyframes shimmer{0%{background-position:0% 50%}50%{background-position:100% 50%}100%{background-position:0% 50%}}`}</style>
    </div>
  );
}
