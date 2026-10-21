import { useState, useEffect, useRef, useCallback } from "react";
import useGameTracking from "src/hooks/useGameTracking";
import { prefersReducedMotion } from "src/lib/motion";
import {
  FOREST, ROAD, OBSTACLE, TIERS, upgradeCost, towerDmg, waveSize, lerpPath, sRng,
  generateMap, createGame, placeTower as placeTowerOn, upgradeTower as upgradeTowerOn,
  sellValue, startWave as startWaveOn, advance, analyzeBalance,
} from "src/lib/games/nanupika/engine";
import {
  LEVELS, loadProgress, saveProgress, recordVictory, currentLevelIndex, isUnlocked, totalStars, starsFor,
} from "src/lib/games/nanupika/campaign";

// The rules (maps, towers, ant scaling, the combat step) live in
// src/lib/games/nanupika/engine.ts and the level ladder in campaign.ts. This
// file draws them and handles input.

// Canvas pixels per tile before the board is scaled to fit the screen.
const CELL=48;
// House style (docs/ART_DIRECTION.md): the house dark, the site's type, and one
// accent — void, for "the siege". Tower hues, gold and stars are game data, not decoration.
const HOUSE={
  dark:"#04120c",                 // forest-950
  ground:"radial-gradient(ellipse at 50% -10%, rgba(139,92,246,0.14), transparent 60%), #04120c",
  ink:"#edf7f0",                  // forest-50
  body:"#a3d9b1",                 // forest-200
  muted:"#6abf82",                // forest-300
  accent:"#a78bfa",               // void-400: highlights, the current level
  action:"#7c3aed",               // void-600: filled buttons (white text passes AA)
  font:"Inter, system-ui, -apple-system, sans-serif",
};
// Phones held upright play the tall version of every map (same road, transposed).
const isPortraitPhone=()=>typeof window!=="undefined"&&window.matchMedia("(orientation: portrait) and (max-width: 700px)").matches;
const getStorage=()=>{try{return window.localStorage;}catch{return null;}};

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
// ── Upgrade aura: a stronger cat looks stronger ──
// Level 2 draws a rune ring in the tower's colour, level 3 adds orbiting sparks,
// level 4+ a halo. `sinceUpgrade` (ms) plays a short expanding flash. With
// reduced motion the sparks hold still and the flash does not expand.
const UPGRADE_FLASH_MS=450;
function drawUpgradeAura(ctx,s,color,level,time,sinceUpgrade,reduced){
  if(level>=4){
    const halo=ctx.createRadialGradient(0,-s*0.05,s*0.05,0,-s*0.05,s*0.55);
    halo.addColorStop(0,`${color}55`);halo.addColorStop(1,`${color}00`);
    ctx.fillStyle=halo;ctx.beginPath();ctx.arc(0,-s*0.05,s*0.55,0,Math.PI*2);ctx.fill();
  }
  if(level>=2){
    ctx.fillStyle=`${color}22`;
    ctx.beginPath();ctx.ellipse(0,s*0.4,s*0.46,s*0.13,0,0,Math.PI*2);ctx.fill();
    ctx.strokeStyle=color;ctx.lineWidth=Math.max(2,s*0.06);
    ctx.beginPath();ctx.ellipse(0,s*0.4,s*0.46,s*0.13,0,0,Math.PI*2);ctx.stroke();
  }
  if(level>=3){
    const sparks=Math.min(level,6),turn=reduced?0:time*0.0015;
    for(let i=0;i<sparks;i++){
      const a=turn+(i/sparks)*Math.PI*2;
      const px=Math.cos(a)*s*0.46,py=s*0.4+Math.sin(a)*s*0.13;
      ctx.fillStyle="#fff";ctx.beginPath();ctx.arc(px,py,Math.max(2,s*0.075),0,Math.PI*2);ctx.fill();
      ctx.fillStyle=color;ctx.beginPath();ctx.arc(px,py,Math.max(1.2,s*0.045),0,Math.PI*2);ctx.fill();
    }
  }
  if(sinceUpgrade>=0&&sinceUpgrade<UPGRADE_FLASH_MS){
    const t=sinceUpgrade/UPGRADE_FLASH_MS,r=reduced?s*0.42:s*(0.3+0.45*t);
    ctx.strokeStyle=color;ctx.globalAlpha=1-t;ctx.lineWidth=Math.max(2,s*0.05);
    ctx.beginPath();ctx.arc(0,0,r,0,Math.PI*2);ctx.stroke();ctx.globalAlpha=1;
  }
}

function drawCat(ctx,x,y,size,state,time,hue,tierId,level,sinceUpgrade=-1,reduced=false){
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
  const tierColor=(TIERS.find(t=>t.id===tierId)||TIERS[0]).color;
  drawUpgradeAura(ctx,s,tierColor,level,time,sinceUpgrade,reduced);

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

  // ── Level badge: gold pips (a number past five) on a dark chip ──
  if(level>1){
    const pips=level<=5?level:0,gap=s*0.13,h=s*0.22;
    const w=pips?gap*pips+s*0.06:s*0.42,bx=0,by=-s*0.62;
    ctx.fillStyle="rgba(4,18,12,0.9)";ctx.strokeStyle="#ffd700";ctx.lineWidth=Math.max(1.2,s*0.03);
    ctx.beginPath();ctx.roundRect(bx-w/2,by-h/2,w,h,h/2);ctx.fill();ctx.stroke();
    ctx.fillStyle="#ffd700";
    if(pips){for(let i=0;i<pips;i++){ctx.beginPath();ctx.arc(bx-w/2+s*0.03+gap*(i+0.5),by,s*0.045,0,Math.PI*2);ctx.fill();}}
    else{ctx.font=`bold ${s*0.16}px Inter, system-ui, sans-serif`;ctx.textAlign="center";ctx.textBaseline="middle";ctx.fillText(`Lv ${level}`,bx,by+s*0.01);}
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
  const [selectedTier,setSelectedTier]=useState(0);
  const [selTower,setSelTower]=useState(null);
  const [started,setStarted]=useState(false);
  // Campaign progress: which levels are cleared and their best stars. Loaded
  // after mount so the server render and the first client render agree.
  const [progress,setProgress]=useState(()=>loadProgress(null));
  useEffect(()=>{setProgress(loadProgress(getStorage()));},[]);
  const progressRef=useRef(progress);
  useEffect(()=>{progressRef.current=progress;},[progress]);
  const [levelIdx,setLevelIdx]=useState(0);
  const levelIdxRef=useRef(0);
  const [dims,setDims]=useState({cols:LEVELS[0].cols,rows:LEVELS[0].rows,tall:false});
  const [ui,setUi]=useState({gold:0,lives:0,wave:1,phase:"prep",antsLeft:0,score:0,towerCount:0,balance:null,maxWaves:LEVELS[0].waves,stars:0});
  const [canvasScale,setCanvasScale]=useState(1);
  const [activeTooltip,setActiveTooltip]=useState(null);
  const [activeTierTip,setActiveTierTip]=useState(null);
  const [gameSpeed,setGameSpeed]=useState(1);
  const gameSpeedRef=useRef(1);
  const reducedRef=useRef(false);
  useEffect(()=>{reducedRef.current=prefersReducedMotion();},[]);
  useEffect(()=>{gameSpeedRef.current=gameSpeed;},[gameSpeed]);
  const waveSnapshotRef=useRef(null);
  // Waves started this game: the "move" count for game tracking. A game starts on
  // the first wave, not on map load, and a retried wave continues the same game.
  const [wavesStarted,setWavesStarted]=useState(0);
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

  const level=LEVELS[levelIdx];

  useGameTracking("nanu-pika-td",{
    moveCount:wavesStarted,
    finished:ui.phase==="gameover"||ui.phase==="victory",
    getStartMeta:()=>({level:levelIdx+1,level_id:level.id,tall:dims.tall}),
    getEndMeta:()=>({level:levelIdx+1,level_id:level.id,tall:dims.tall,result:ui.phase==="victory"?"win":"loss",wave:ui.wave,max_waves:ui.maxWaves,score:ui.score}),
  });
  const cW=dims.cols*CELL, cH=dims.rows*CELL;

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
  },[cW,cH,started]);

  // Sets up a level. The orientation is decided here and kept for the whole
  // level, so turning the phone mid-wave rescales the board instead of rebuilding it.
  const initGame=useCallback((idx)=>{
    const lv=LEVELS[idx];
    const tall=isPortraitPhone();
    const map=generateMap(lv.template,lv.cols,lv.rows,tall);
    const seedGrid=Array.from({length:map.rows},(_,r)=>Array.from({length:map.cols},(_,c)=>r*map.cols+c+idx*997+42));
    terrainRef.current=buildTerrainCache(map.grid,seedGrid,map.cols,map.rows,CELL);
    gameRef.current={...createGame(map,lv),cell:CELL,projectiles:[],particles:[],lastTick:performance.now(),seedGrid,hoverCell:null};
    levelIdxRef.current=idx;setLevelIdx(idx);setDims({cols:map.cols,rows:map.rows,tall});
    snapshotWave(gameRef.current);setWavesStarted(0);
    setSelTower(null);previewCellRef.current=null;setUi({gold:lv.startGold,lives:lv.lives,wave:1,phase:"prep",antsLeft:waveSize(1),score:0,towerCount:0,balance:null,maxWaves:lv.waves,stars:0});
  },[]);

  const playLevel=useCallback((idx)=>{setStarted(true);setTimeout(()=>initGame(idx),50);},[initGame]);

  // Retry the current wave from the snapshot taken when the wave began.
  // Restores towers, gold, lives and score — works mid-wave and on game over.
  const retryWave=useCallback(()=>{
    const g=gameRef.current;const snap=waveSnapshotRef.current;
    if(!g||!snap)return;
    g.towers=snap.towers.map(t=>({...t,state:"idle",attackTimer:0,lastFired:0}));
    g.gold=snap.gold;g.lives=snap.lives;g.score=snap.score;g.wave=snap.wave;
    g.ants=[];g.projectiles=[];g.particles=[];
    g.phase="prep";g.spawned=0;g.spawnTimer=0;g.ws=waveSize(g.wave);g.hoverCell=null;g.gameTime=0;g.pendingMs=0;
    for(const t of g.towers)t.lastFired=0;
    setSelTower(null);previewCellRef.current=null;
    setUi(s=>({...s,gold:g.gold,lives:g.lives,wave:g.wave,score:g.score,phase:"prep",antsLeft:g.ws,towerCount:g.towers.length,balance:null}));
  },[]);

  const placeTower=useCallback((row,col)=>{const g=gameRef.current;if(!g)return false;if(!placeTowerOn(g,row,col,selectedTier))return false;setUi(s=>({...s,gold:g.gold,towerCount:g.towers.length}));return true;},[selectedTier]);

  const upgradeTower=useCallback((row,col)=>{const g=gameRef.current;if(!g)return;const t=g.towers.find(t=>t.row===row&&t.col===col);if(!t||!upgradeTowerOn(g,t))return;t.upgradedAt=performance.now();setSelTower({row,col,level:t.level,tierId:t.tierId,tierIdx:t.tierIdx});setUi(s=>({...s,gold:g.gold}));},[]);

  const sellTower=useCallback((row,col)=>{const g=gameRef.current;if(!g||g.phase==="wave")return;const idx=g.towers.findIndex(t=>t.row===row&&t.col===col);if(idx===-1)return;g.gold+=sellValue(g.towers[idx]);g.towers.splice(idx,1);setSelTower(null);setUi(s=>({...s,gold:g.gold,towerCount:g.towers.length}));},[]);

  const startWave=useCallback(()=>{const g=gameRef.current;if(!g||!startWaveOn(g))return;g.projectiles=[];g.hoverCell=null;setWavesStarted(n=>n+1);setSelTower(null);previewCellRef.current=null;setUi(s=>({...s,phase:"wave",balance:analyzeBalance(g)}));},[]);

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
      const C=g.cell;
      if(g.phase==="wave"){
        const burst=(x,y,n,base)=>{for(let i=0;i<n;i++)g.particles.push(base(i,x,y));};
        const event=advance(g,dt,{
          onShot:(tower,at,killed)=>{
            const hitX=at.col*C+C/2,hitY=at.row*C+C/2;
            g.projectiles.push({sx:tower.col*C+C/2,sy:tower.row*C+C/2,tx:hitX,ty:hitY,t:0,hue:tower.hue,big:tower.splash>0});
            burst(hitX,hitY,5,(i,x,y)=>{const a=Math.random()*Math.PI*2,sp=1+Math.random()*2.5;return{x,y,vx:Math.cos(a)*sp,vy:Math.sin(a)*sp,life:350,maxLife:350,size:2+Math.random()*2,hue:killed?0:tower.hue+60,type:killed?"death":"hit"};});
          },
          onKill:(at)=>{
            burst(at.col*C+C/2,at.row*C+C/2,8,(i,x,y)=>{const a=(i/8)*Math.PI*2;return{x,y,vx:Math.cos(a)*2,vy:Math.sin(a)*2,life:500,maxLife:500,size:2.5,hue:30,type:"death"};});
          },
        });
        for(const p of g.projectiles)p.t+=dt/140;g.projectiles=g.projectiles.filter(p=>p.t<1);
        for(const p of g.particles){p.x+=p.vx*(dt/16);p.y+=p.vy*(dt/16);p.vy+=0.04*(dt/16);p.life-=dt;}g.particles=g.particles.filter(p=>p.life>0);
        if(event==="gameover"){setUi(s=>({...s,phase:"gameover",lives:0,gold:g.gold,score:g.score}));}
        else if(event==="victory"){
          const lv=LEVELS[levelIdxRef.current];
          const next=recordVictory(progressRef.current,lv.id,g.lives,lv.lives,g.score);
          progressRef.current=next;saveProgress(getStorage(),next);setProgress(next);
          setUi(s=>({...s,phase:"victory",lives:g.lives,gold:g.gold,score:g.score,antsLeft:0,stars:starsFor(g.lives,lv.lives)}));
        }
        else if(event==="wave_cleared"){g.particles=[];g.projectiles=[];snapshotWave(g);setUi(s=>({...s,gold:g.gold,lives:g.lives,wave:g.wave,phase:"prep",antsLeft:g.ws,score:g.score,towerCount:g.towers.length,balance:null}));}
        else{const alive=g.ants.filter(a=>!a.dead).length;setUi(s=>({...s,gold:g.gold,lives:g.lives,antsLeft:g.ws-g.spawned+alive,score:g.score}));}
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
      for(const t of g.towers)drawCat(ctx,t.col*C+C/2,t.row*C+C/2+2,C*0.7,t.state==="attack"?"attack":"idle",now,t.hue,t.tierId,t.level,t.upgradedAt?now-t.upgradedAt:-1,reducedRef.current);
      // Particles
      for(const p of g.particles){const a=p.life/p.maxLife;ctx.fillStyle=p.type==="death"?`hsla(${p.hue},90%,55%,${a})`:`hsla(${p.hue},100%,70%,${a})`;ctx.beginPath();ctx.arc(p.x,p.y,p.size*a,0,Math.PI*2);ctx.fill();}
      // End overlays
      if(g.phase==="gameover"||g.phase==="victory"){ctx.fillStyle="rgba(10,5,20,0.7)";ctx.fillRect(0,0,cw,ch);ctx.textAlign="center";ctx.textBaseline="middle";const fs=Math.min(48,C*1.2);ctx.fillStyle=g.phase==="victory"?"#ffd700":"#ff6b6b";ctx.font=`bold ${fs}px Inter, system-ui, sans-serif`;ctx.fillText(g.phase==="victory"?"Victory!":"Game Over!",cw/2,ch/2-fs*0.6);ctx.fillStyle="#e0d0b0";ctx.font=`${fs*0.45}px Inter, system-ui, sans-serif`;ctx.fillText(`Score: ${g.score}  ·  Wave ${g.wave}/${g.maxWaves}`,cw/2,ch/2+fs*0.2);}
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

  // ─── Campaign Screen ───────────────────────────────────────────────────────
  // One trail of levels, played in order. Cleared levels show their stars and
  // can be replayed; the next one is highlighted; the rest stay locked.
  const nextIdx=currentLevelIndex(progress);
  const allCleared=nextIdx>=LEVELS.length;
  const starLine=(n)=>"★".repeat(n)+"☆".repeat(3-n);
  if(!started)return(
    <div style={{display:"flex",flexDirection:"column",alignItems:"center",background:HOUSE.ground,minHeight:"100vh",fontFamily:HOUSE.font,color:HOUSE.body,padding:"28px 16px 40px",gap:"14px"}}>
      <h1 style={{fontSize:"30px",fontWeight:800,letterSpacing:"-0.02em",textAlign:"center",color:HOUSE.ink}}>Nanu &amp; Pika <span style={{color:HOUSE.accent}}>Adventures</span></h1>
      <p style={{color:HOUSE.body,fontSize:"14px",maxWidth:"420px",textAlign:"center",lineHeight:1.5}}>Hold the forest road against the ants. Each level is a longer, tougher siege than the last.</p>
      <div style={{fontSize:"11px",color:HOUSE.muted,letterSpacing:"0.18em",textTransform:"uppercase",fontFamily:"ui-monospace, SFMono-Regular, Menlo, monospace"}}>
        {allCleared?"Every level cleared":`Level ${nextIdx+1} of ${LEVELS.length}`} · <span style={{color:"#ffd700"}}>{totalStars(progress)} / {LEVELS.length*3} ★</span>
      </div>
      <button onClick={()=>playLevel(allCleared?LEVELS.length-1:nextIdx)} style={{...btn,padding:"12px 32px",fontSize:"16px",background:HOUSE.action,color:"#fff",boxShadow:"0 4px 24px rgba(124,58,237,0.35)"}}>
        {allCleared?`Replay ${LEVELS[LEVELS.length-1].name}`:`${nextIdx===0?"Start":"Continue"}: ${LEVELS[nextIdx].name}`}
      </button>
      <ol style={{listStyle:"none",padding:0,margin:"8px 0 0",display:"flex",flexDirection:"column",gap:"6px",width:"100%",maxWidth:"420px"}} aria-label="Campaign progress">
        {LEVELS.map((lv,i)=>{
          const rec=progress.cleared[lv.id];
          const open=isUnlocked(progress,i);
          const current=i===nextIdx;
          return(
            <li key={lv.id}>
              <button
                onClick={()=>open&&playLevel(i)}
                disabled={!open}
                aria-label={`Level ${i+1}, ${lv.name}${rec?`, cleared with ${rec.stars} of 3 stars`:open?", next up":", locked"}`}
                style={{width:"100%",display:"flex",alignItems:"center",gap:"12px",padding:"10px 12px",textAlign:"left",borderRadius:"10px",cursor:open?"pointer":"not-allowed",color:HOUSE.ink,
                  background:current?"rgba(167,139,250,0.10)":"rgba(255,255,255,0.03)",
                  border:current?`2px solid ${HOUSE.accent}88`:"2px solid transparent",opacity:open?1:0.45}}>
                <span style={{flexShrink:0,width:"28px",height:"28px",borderRadius:"50%",display:"flex",alignItems:"center",justifyContent:"center",fontSize:"13px",fontWeight:800,
                  background:rec?HOUSE.accent:current?"rgba(167,139,250,0.2)":"rgba(255,255,255,0.08)",color:rec?HOUSE.dark:HOUSE.ink}}>{rec?"✓":i+1}</span>
                <span style={{flex:1,minWidth:0}}>
                  <span style={{display:"block",fontSize:"14px",fontWeight:700,color:current?HOUSE.accent:HOUSE.ink}}>{lv.name}</span>
                  <span style={{display:"block",fontSize:"11px",color:HOUSE.muted,marginTop:"2px"}}>{open?lv.blurb:"Clear the level before to unlock."}</span>
                </span>
                <span style={{flexShrink:0,fontSize:"12px",color:rec?"#ffd700":"#555",letterSpacing:"1px"}} aria-hidden="true">{rec?starLine(rec.stars):open?`${lv.waves} waves`:"🔒"}</span>
              </button>
            </li>
          );
        })}
      </ol>
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
    <div ref={containerRef} onClick={()=>setActiveTooltip(null)} style={{display:"flex",flexDirection:"column",height:"100dvh",overflow:"hidden",background:HOUSE.ground,fontFamily:HOUSE.font,color:HOUSE.body,userSelect:"none",touchAction:"manipulation"}}>

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
          <div style={{display:"flex",alignItems:"center",padding:"4px 8px",fontSize:"9px",color:"#555",letterSpacing:"0.04em"}}>Lv {levelIdx+1} · {level.name}</div>
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
                  style={{...btn,padding:"2px 8px",fontSize:"9px",background:ui.gold>=upCost?HOUSE.action:"#1b4332",color:ui.gold>=upCost?"#fff":HOUSE.muted}}
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
          {ui.phase==="prep"&&ui.gold>=TIERS[0].cost&&ui.wave>1&&(
            <div role="status" style={{width:"100%",textAlign:"center",fontSize:"11px",color:"#ffd66e"}}>
              {ui.gold} gold to spend — place another cat or tap one to upgrade before the next wave.
            </div>
          )}
          {ui.phase==="prep"&&(<>
            <button
              onClick={startWave}
              title={`Begin Wave ${ui.wave}. ${waveSize(ui.wave)} ants will spawn. Once it starts, you can't place towers until the wave ends.`}
              style={{...btn,background:HOUSE.action,color:"#fff",padding:"7px 18px"}}
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
              onClick={()=>initGame(levelIdx)}
              title="Start this level again from Wave 1. You'll lose your towers on this attempt."
              style={{...btn,background:"rgba(255,255,255,0.06)",color:"#888",fontSize:"11px",padding:"6px 12px"}}
            >Restart Level</button>
            <button
              onClick={()=>{setStarted(false);}}
              title="Back to the level trail. Cleared levels keep their stars."
              style={{...btn,background:"rgba(255,255,255,0.04)",color:"#888",fontSize:"11px",padding:"6px 12px"}}
            >Levels</button>
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
              style={{...btn,background:HOUSE.action,color:"#fff",padding:"7px 18px"}}
            >Retry Wave {ui.wave}</button>}
            {ui.phase==="victory"&&(
              <div style={{padding:"5px 12px",fontSize:"13px",color:"#ffd700",letterSpacing:"2px"}} aria-label={`${ui.stars} of 3 stars`}>{starLine(ui.stars)}</div>
            )}
            {ui.phase==="victory"&&levelIdx<LEVELS.length-1&&<button
              onClick={()=>initGame(levelIdx+1)}
              title={`Go on to Level ${levelIdx+2}: ${LEVELS[levelIdx+1].name}.`}
              style={{...btn,background:HOUSE.action,color:"#fff",padding:"7px 18px"}}
            >Next: {LEVELS[levelIdx+1].name} →</button>}
            <button
              onClick={()=>initGame(levelIdx)}
              title={ui.phase==="victory"?"Play this level again for more stars.":"Start this level again from Wave 1."}
              style={{...btn,background:"rgba(255,255,255,0.08)",color:HOUSE.ink,padding:"7px 18px"}}
            >{ui.phase==="victory"?"Replay":"Restart Level"}</button>
            <button
              onClick={()=>setStarted(false)}
              title="Back to the level trail."
              style={{...btn,background:"rgba(255,255,255,0.06)",color:"#aaa",fontSize:"11px",padding:"6px 14px"}}
            >Levels</button>
          </>)}
        </div>

        {/* Legend — touch + mouse + keyboard mental model */}
        <div style={{fontSize:"9px",color:"#444",display:"flex",gap:"10px",flexWrap:"wrap",justifyContent:"center"}}>
          <span style={{color:"#4a8040"}}>Click forest tile to place selected tower</span>
          <span style={{color:"#907040"}}>Click placed tower to select &amp; upgrade</span>
          <span style={{color:"#666"}}>Right-click a tower to sell (between waves)</span>
          <span style={{color:"#555"}}>Level {levelIdx+1} of {LEVELS.length} · {level.name}</span>
        </div>
      </div>

      <style>{`@keyframes pulse{0%,100%{opacity:1}50%{opacity:0.5}}`}</style>
    </div>
  );
}
