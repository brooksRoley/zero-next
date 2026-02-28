import { useState, useEffect, useRef, useCallback } from "react";

// ─── Grid ────────────────────────────────────────────────────────────────────
const COLS = 24, ROWS = 8, CELL = 60, W = COLS * CELL, H = ROWS * CELL;
const FOREST = 0, ROAD = 1, OBSTACLE = 2;

// ─── Tower Tiers ─────────────────────────────────────────────────────────────
const TIERS = [
  {
    id: "apprentice", name: "Apprentice", emoji: "🔮",
    baseCost: 30, dmg: 12, range: 2.0, cooldown: 1000, splash: 0,
    desc: "Cheap, short range", hueBase: 210,
    color: "#7eb8ff", upgradeCostMul: 1,
  },
  {
    id: "pyromancer", name: "Pyromancer", emoji: "🔥",
    baseCost: 65, dmg: 22, range: 2.2, cooldown: 1200, splash: 0.8,
    desc: "Splash damage, medium range", hueBase: 10,
    color: "#ff7755", upgradeCostMul: 1.5,
  },
  {
    id: "frostclaw", name: "Frostclaw", emoji: "❄️",
    baseCost: 55, dmg: 10, range: 3.0, cooldown: 700, splash: 0,
    desc: "Fast attack, long range", hueBase: 190,
    color: "#55ddff", upgradeCostMul: 1.3,
  },
  {
    id: "archsage", name: "Archsage", emoji: "⚡",
    baseCost: 120, dmg: 45, range: 2.5, cooldown: 1800, splash: 1.2,
    desc: "Devastating power, slow", hueBase: 55,
    color: "#ffdd44", upgradeCostMul: 2.2,
  },
];

// ─── Economy & Scaling ───────────────────────────────────────────────────────
const START_GOLD = 100;
const START_LIVES = 20;
const ANT_HP_BASE = 35;
const ANT_SPEED_BASE = 0.013;
const SPAWN_INTERVAL_BASE = 1300;
const WAVE_SIZE_BASE = 8;
const KILL_REWARD_BASE = 6;
const WAVE_BONUS_BASE = 25;
const MIN_DIFFICULTY = 3;

const scaleHp    = l => Math.floor(ANT_HP_BASE * (1 + (l - 1) * 0.38));
const scaleCost  = (tier, l) => Math.floor(tier.baseCost * (1 + (l - 1) * 0.06));
const scaleDmg   = (tier, l) => Math.floor(tier.dmg * (1 + (l - 1) * 0.10));
const scaleWave  = l => WAVE_SIZE_BASE + Math.floor(l * 2.5);
const scaleSpawn = l => Math.max(350, SPAWN_INTERVAL_BASE - l * 50);
const scaleSpeed = l => ANT_SPEED_BASE * (1 + (l - 1) * 0.025);
const scaleReward = l => Math.floor(KILL_REWARD_BASE + l * 1.2);
const waveBonus  = l => WAVE_BONUS_BASE + l * 8;

// ─── Helpers ─────────────────────────────────────────────────────────────────
function dist(a, b) { return Math.sqrt((a.col - b.col) ** 2 + (a.row - b.row) ** 2); }
function lerpPath(path, t) {
  const i = Math.min(Math.floor(t), path.length - 2), f = t - i;
  const a = path[i], b = path[Math.min(i + 1, path.length - 1)];
  return { row: a.row + (b.row - a.row) * f, col: a.col + (b.col - a.col) * f };
}

// ─── Path Generation ─────────────────────────────────────────────────────────
function generatePath(level) {
  let best = null, bestScore = -1;
  for (let attempt = 0; attempt < 25; attempt++) {
    const grid = Array.from({ length: ROWS }, () => Array(COLS).fill(FOREST));
    const path = [];
    let row = 1 + Math.floor(Math.random() * (ROWS - 2)), col = 0, turns = 0, valid = true;
    while (col < COLS) {
      if (row < 0 || row >= ROWS) { valid = false; break; }
      grid[row][col] = ROAD; path.push({ row, col });
      if (col === COLS - 1) break;
      const canUp = row > 1 && grid[row-1]?.[col] !== ROAD && grid[row-2]?.[col] !== ROAD;
      const canDown = row < ROWS-2 && grid[row+1]?.[col] !== ROAD && grid[row+2]?.[col] !== ROAD;
      const turnCh = Math.min(0.45, 0.15 + level * 0.02);
      const dblCh = Math.min(0.2, 0.05 + level * 0.015);
      const r = Math.random();
      if (r < turnCh && canUp) {
        row--; grid[row][col] = ROAD; path.push({ row, col }); turns++;
        if (Math.random() < dblCh && row > 1 && grid[row-1]?.[col] !== ROAD) {
          row--; grid[row][col] = ROAD; path.push({ row, col }); turns++;
        }
      } else if (r < turnCh * 2 && canDown) {
        row++; grid[row][col] = ROAD; path.push({ row, col }); turns++;
        if (Math.random() < dblCh && row < ROWS-2 && grid[row+1]?.[col] !== ROAD) {
          row++; grid[row][col] = ROAD; path.push({ row, col }); turns++;
        }
      }
      col++;
    }
    if (!valid) continue;
    const vSpread = new Set(path.map(p => p.row)).size;
    const score = turns * 3 + (path.length / (COLS + ROWS)) * 2 + vSpread * 2;
    if (turns >= Math.min(level + MIN_DIFFICULTY, 10) && score > bestScore) {
      bestScore = score; best = { grid, path };
    }
  }
  if (!best) {
    const grid = Array.from({ length: ROWS }, () => Array(COLS).fill(FOREST));
    const path = []; let row = Math.floor(ROWS / 2);
    for (let c = 0; c < COLS; c++) {
      grid[row][c] = ROAD; path.push({ row, col: c });
      if (c % 3 === 0 && row > 1) { row--; grid[row][c] = ROAD; path.push({ row, col: c }); }
      else if (c % 3 === 1 && row < ROWS-2) { row++; grid[row][c] = ROAD; path.push({ row, col: c }); }
    }
    best = { grid, path };
  }
  const od = Math.min(0.13, 0.05 + level * 0.007);
  for (let r = 0; r < ROWS; r++)
    for (let c = 0; c < COLS; c++)
      if (best.grid[r][c] === FOREST && Math.random() < od) best.grid[r][c] = OBSTACLE;
  return best;
}

// ─── Drawing Functions ───────────────────────────────────────────────────────

function drawCatWizard(ctx, x, y, size, state, time, hue, tierId) {
  const s = size;
  const bounce = Math.sin(time * 0.004) * 2;
  const atk = state === "attack";
  ctx.save();
  ctx.translate(x, y + bounce);

  // Shadow
  ctx.fillStyle = "rgba(0,0,0,0.18)";
  ctx.beginPath(); ctx.ellipse(0, s*0.42, s*0.32, s*0.08, 0, 0, Math.PI*2); ctx.fill();

  // Robe
  const robeG = ctx.createLinearGradient(0, -s*0.1, 0, s*0.4);
  robeG.addColorStop(0, `hsl(${hue},60%,45%)`); robeG.addColorStop(1, `hsl(${hue},50%,28%)`);
  ctx.fillStyle = robeG;
  ctx.beginPath();
  ctx.moveTo(-s*0.22, 0); ctx.quadraticCurveTo(-s*0.3, s*0.35, -s*0.18, s*0.4);
  ctx.lineTo(s*0.18, s*0.4); ctx.quadraticCurveTo(s*0.3, s*0.35, s*0.22, 0);
  ctx.closePath(); ctx.fill();

  // Tier-specific robe accent
  if (tierId === "pyromancer") {
    ctx.strokeStyle = "rgba(255,120,30,0.6)"; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(-s*0.16, s*0.38); ctx.lineTo(s*0.16, s*0.38); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(-s*0.12, s*0.32); ctx.lineTo(s*0.12, s*0.32); ctx.stroke();
  } else if (tierId === "frostclaw") {
    ctx.strokeStyle = "rgba(150,220,255,0.5)"; ctx.lineWidth = 1.5;
    for (let i = 0; i < 3; i++) {
      const sy = s*0.15 + i*s*0.09;
      ctx.beginPath();
      ctx.moveTo(-s*0.15, sy);
      ctx.lineTo(-s*0.08, sy - s*0.03); ctx.lineTo(0, sy);
      ctx.lineTo(s*0.08, sy - s*0.03); ctx.lineTo(s*0.15, sy);
      ctx.stroke();
    }
  } else if (tierId === "archsage") {
    ctx.strokeStyle = `hsla(50,100%,70%,${0.3 + Math.sin(time*0.005)*0.2})`;
    ctx.lineWidth = 1.5;
    const starY = s*0.2;
    for (let i = 0; i < 5; i++) {
      const a = (i/5)*Math.PI*2 - Math.PI/2;
      const a2 = ((i+2)/5)*Math.PI*2 - Math.PI/2;
      ctx.beginPath();
      ctx.moveTo(Math.cos(a)*s*0.1, starY + Math.sin(a)*s*0.1);
      ctx.lineTo(Math.cos(a2)*s*0.1, starY + Math.sin(a2)*s*0.1);
      ctx.stroke();
    }
  }

  // Head
  const headY = -s*0.12;
  ctx.fillStyle = `hsl(${hue+15},25%,80%)`;
  ctx.beginPath(); ctx.arc(0, headY, s*0.2, 0, Math.PI*2); ctx.fill();

  // Ears
  for (const side of [-1, 1]) {
    ctx.fillStyle = `hsl(${hue+15},25%,80%)`;
    ctx.beginPath();
    ctx.moveTo(side*s*0.16, headY-s*0.14);
    ctx.lineTo(side*s*0.22, headY-s*0.32);
    ctx.lineTo(side*s*0.06, headY-s*0.18);
    ctx.closePath(); ctx.fill();
    ctx.fillStyle = `hsl(${hue},50%,65%)`;
    ctx.beginPath();
    ctx.moveTo(side*s*0.14, headY-s*0.15);
    ctx.lineTo(side*s*0.19, headY-s*0.28);
    ctx.lineTo(side*s*0.08, headY-s*0.17);
    ctx.closePath(); ctx.fill();
  }

  // Hat
  const hatH = tierId === "archsage" ? 0.65 : 0.55;
  const hatG = ctx.createLinearGradient(0, headY-s*hatH, 0, headY-s*0.1);
  hatG.addColorStop(0, `hsl(${hue+200},70%,25%)`); hatG.addColorStop(1, `hsl(${hue+200},60%,40%)`);
  ctx.fillStyle = hatG;
  ctx.beginPath(); ctx.ellipse(0, headY-s*0.15, s*0.28, s*0.06, 0, 0, Math.PI*2); ctx.fill();
  const lean = Math.sin(time*0.003)*0.05;
  ctx.beginPath();
  ctx.moveTo(-s*0.2, headY-s*0.15);
  ctx.quadraticCurveTo(s*lean, headY-s*(hatH-0.05), s*0.04, headY-s*hatH);
  ctx.lineTo(s*0.2, headY-s*0.15);
  ctx.closePath(); ctx.fill();

  // Hat emblem per tier
  const emblemY = headY - s*(hatH*0.6);
  ctx.font = `${s*0.11}px serif`; ctx.textAlign = "center"; ctx.textBaseline = "middle";
  if (tierId === "apprentice") { ctx.fillStyle = "#aaddff"; ctx.fillText("✦", s*0.02, emblemY); }
  else if (tierId === "pyromancer") { ctx.fillStyle = "#ff8844"; ctx.fillText("🔥", s*0.02, emblemY); }
  else if (tierId === "frostclaw") { ctx.fillStyle = "#88eeff"; ctx.fillText("❄", s*0.02, emblemY); }
  else if (tierId === "archsage") { ctx.fillStyle = "#ffee55"; ctx.fillText("⚡", s*0.02, emblemY); }

  // Eyes
  const blink = Math.floor(time/2500)%8 === 0 && (time%2500) < 120;
  if (blink) {
    ctx.strokeStyle = "#333"; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(-s*0.09, headY+s*0.01); ctx.lineTo(-s*0.04, headY+s*0.01); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(s*0.04, headY+s*0.01); ctx.lineTo(s*0.09, headY+s*0.01); ctx.stroke();
  } else {
    ctx.fillStyle = atk ? "#fff5cc" : "#fff";
    ctx.beginPath(); ctx.ellipse(-s*0.07, headY+s*0.01, s*0.055, s*0.06, 0, 0, Math.PI*2); ctx.fill();
    ctx.beginPath(); ctx.ellipse(s*0.07, headY+s*0.01, s*0.055, s*0.06, 0, 0, Math.PI*2); ctx.fill();
    ctx.fillStyle = atk ? "#ff3300" : "#222";
    ctx.beginPath(); ctx.arc(-s*0.07, headY+s*0.015, s*0.03, 0, Math.PI*2); ctx.fill();
    ctx.beginPath(); ctx.arc(s*0.07, headY+s*0.015, s*0.03, 0, Math.PI*2); ctx.fill();
    ctx.fillStyle = "#fff";
    ctx.beginPath(); ctx.arc(-s*0.06, headY, s*0.01, 0, Math.PI*2); ctx.fill();
    ctx.beginPath(); ctx.arc(s*0.08, headY, s*0.01, 0, Math.PI*2); ctx.fill();
  }

  // Nose + mouth
  ctx.fillStyle = "#e8a0a0";
  ctx.beginPath(); ctx.moveTo(0, headY+s*0.07); ctx.lineTo(-s*0.02, headY+s*0.1); ctx.lineTo(s*0.02, headY+s*0.1); ctx.closePath(); ctx.fill();
  ctx.strokeStyle = "#b07070"; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(-s*0.04, headY+s*0.12); ctx.quadraticCurveTo(0, headY+s*0.15, s*0.04, headY+s*0.12); ctx.stroke();

  // Whiskers
  ctx.strokeStyle = "rgba(100,80,80,0.35)"; ctx.lineWidth = 0.8;
  for (const sd of [-1, 1])
    for (const ang of [-0.15, 0, 0.15]) {
      ctx.beginPath(); ctx.moveTo(sd*s*0.12, headY+s*0.08);
      ctx.lineTo(sd*s*0.32, headY+s*0.06 + ang*s*0.3); ctx.stroke();
    }

  // Staff
  const staffX = s*0.28, sw = Math.sin(time*0.005)*3;
  ctx.strokeStyle = "#8B6914"; ctx.lineWidth = 2.5;
  ctx.beginPath(); ctx.moveTo(staffX, s*0.35); ctx.lineTo(staffX+sw*0.3, -s*0.35); ctx.stroke();

  // Staff orb
  const gr = atk ? s*0.18 : s*0.09 + Math.sin(time*0.006)*s*0.03;
  const orbH = tierId === "pyromancer" ? 15 : tierId === "frostclaw" ? 190 : tierId === "archsage" ? 50 : (hue+60)%360;
  const og = ctx.createRadialGradient(staffX+sw*0.3, -s*0.38, 0, staffX+sw*0.3, -s*0.38, gr);
  og.addColorStop(0, atk ? "rgba(255,100,50,0.9)" : `hsla(${orbH},100%,75%,0.8)`);
  og.addColorStop(0.5, atk ? "rgba(255,50,0,0.4)" : `hsla(${orbH},100%,65%,0.3)`);
  og.addColorStop(1, "rgba(255,255,200,0)");
  ctx.fillStyle = og;
  ctx.beginPath(); ctx.arc(staffX+sw*0.3, -s*0.38, gr, 0, Math.PI*2); ctx.fill();
  ctx.fillStyle = atk ? "#fff" : `hsl(${orbH},100%,85%)`;
  ctx.beginPath(); ctx.arc(staffX+sw*0.3, -s*0.38, s*0.04, 0, Math.PI*2); ctx.fill();

  ctx.restore();
}

function drawAnt(ctx, x, y, size, hp, maxHp, time, variant) {
  const s = size, walk = Math.sin(time*0.012+variant)*2;
  ctx.save(); ctx.translate(x, y);
  ctx.fillStyle = "rgba(0,0,0,0.2)";
  ctx.beginPath(); ctx.ellipse(0, s*0.28, s*0.25, s*0.05, 0, 0, Math.PI*2); ctx.fill();
  ctx.strokeStyle = "#1a0a00"; ctx.lineWidth = 1.5;
  for (let i = -1; i <= 1; i++) {
    const lp = walk+i*1.2, lx = i*s*0.12;
    ctx.beginPath(); ctx.moveTo(lx-s*0.06, s*0.05); ctx.lineTo(lx-s*0.22, s*0.2+Math.sin(lp)*3); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(lx+s*0.06, s*0.05); ctx.lineTo(lx+s*0.22, s*0.2+Math.cos(lp)*3); ctx.stroke();
  }
  const bc = hp/maxHp > 0.5 ? "#3d1a00" : hp/maxHp > 0.25 ? "#6a2200" : "#8b0000";
  ctx.fillStyle = bc;
  ctx.beginPath(); ctx.ellipse(-s*0.01, s*0.08, s*0.14, s*0.11, 0, 0, Math.PI*2); ctx.fill();
  ctx.beginPath(); ctx.ellipse(s*0.1, s*0.02, s*0.09, s*0.08, 0.3, 0, Math.PI*2); ctx.fill();
  ctx.fillStyle = "#2a0e00";
  ctx.beginPath(); ctx.arc(s*0.2, -s*0.04, s*0.07, 0, Math.PI*2); ctx.fill();
  ctx.strokeStyle = "#2a0e00"; ctx.lineWidth = 1;
  const aw = Math.sin(time*0.008+variant)*4;
  ctx.beginPath(); ctx.moveTo(s*0.24,-s*0.08); ctx.quadraticCurveTo(s*0.32,-s*0.22+aw,s*0.36,-s*0.18); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(s*0.24,-s*0.04); ctx.quadraticCurveTo(s*0.34,-s*0.16-aw,s*0.38,-s*0.12); ctx.stroke();
  ctx.fillStyle = "#ff3300";
  ctx.beginPath(); ctx.arc(s*0.23,-s*0.06,s*0.02,0,Math.PI*2); ctx.fill();
  ctx.beginPath(); ctx.arc(s*0.23,-s*0.02,s*0.02,0,Math.PI*2); ctx.fill();
  const mo = Math.sin(time*0.01)*2;
  ctx.strokeStyle = "#1a0a00"; ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.moveTo(s*0.26,-s*0.03); ctx.lineTo(s*0.32,-s*0.01+mo); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(s*0.26,-s*0.05); ctx.lineTo(s*0.32,-s*0.07-mo); ctx.stroke();
  const bw=s*0.5, bh=3, by=-s*0.28;
  ctx.fillStyle = "rgba(0,0,0,0.5)"; ctx.fillRect(-bw/2,by,bw,bh);
  const pct = Math.max(0, hp/maxHp);
  ctx.fillStyle = pct>0.5?"#44ff44":pct>0.25?"#ffcc00":"#ff3333";
  ctx.fillRect(-bw/2,by,bw*pct,bh);
  ctx.restore();
}

function drawForestTile(ctx, x, y, s, seed, time) {
  const g1=75+Math.sin(seed*3.7)*20, g2=140+Math.sin(seed*2.3)*25, g3=55+Math.sin(seed*5.1)*15;
  ctx.fillStyle = `rgb(${g1|0},${g2|0},${g3|0})`; ctx.fillRect(x,y,s,s);
  ctx.strokeStyle = `rgba(${(g1-10)|0},${(g2+20)|0},${(g3-5)|0},0.5)`; ctx.lineWidth = 1;
  const rng = i => Math.sin(seed*13.37+i*7.91);
  for (let i=0;i<4;i++) {
    const bx=x+8+rng(i)*(s-16), by=y+s-4, sw=Math.sin(time*0.002+seed+i)*3;
    ctx.beginPath(); ctx.moveTo(bx,by); ctx.quadraticCurveTo(bx+sw,by-10-rng(i+5)*6,bx+sw*1.5,by-16-rng(i+3)*5); ctx.stroke();
  }
  if (rng(42)>0.5) {
    const fx=x+10+rng(99)*(s-20), fy=y+10+rng(77)*(s-20), fh=(seed*137)%360;
    ctx.fillStyle = `hsl(${fh},80%,70%)`;
    for (let p=0;p<5;p++) { const a=(p/5)*Math.PI*2; ctx.beginPath(); ctx.arc(fx+Math.cos(a)*3,fy+Math.sin(a)*3,2,0,Math.PI*2); ctx.fill(); }
    ctx.fillStyle = "#ffe066"; ctx.beginPath(); ctx.arc(fx,fy,1.5,0,Math.PI*2); ctx.fill();
  }
}

function drawRoadTile(ctx, x, y, s, seed, nb) {
  const gr = ctx.createLinearGradient(x,y,x+s,y+s);
  gr.addColorStop(0,"#c9a96e"); gr.addColorStop(0.5,"#bfa060"); gr.addColorStop(1,"#c9a96e");
  ctx.fillStyle = gr; ctx.fillRect(x,y,s,s);
  const rng = i => Math.sin(seed*17.3+i*11.7);
  ctx.fillStyle = "rgba(70,130,50,0.35)";
  if (!nb.up) for (let i=0;i<5;i++) { ctx.beginPath(); ctx.arc(x+4+rng(i)*(s-8),y+2,3+rng(i+10)*2,0,Math.PI*2); ctx.fill(); }
  if (!nb.down) for (let i=0;i<5;i++) { ctx.beginPath(); ctx.arc(x+4+rng(i+20)*(s-8),y+s-2,3+rng(i+30)*2,0,Math.PI*2); ctx.fill(); }
  ctx.fillStyle = "rgba(120,95,55,0.5)";
  for (let i=0;i<6;i++) { ctx.beginPath(); ctx.arc(x+6+Math.abs(rng(i*3))*(s-12),y+6+Math.abs(rng(i*3+1))*(s-12),1.5+Math.abs(rng(i*3+2))*1.5,0,Math.PI*2); ctx.fill(); }
  ctx.strokeStyle = "rgba(100,80,40,0.15)"; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(x,y+s*0.35); ctx.lineTo(x+s,y+s*0.35); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(x,y+s*0.65); ctx.lineTo(x+s,y+s*0.65); ctx.stroke();
}

function drawObstacleTile(ctx, x, y, s, seed) {
  ctx.fillStyle = `rgb(${55+Math.sin(seed)*10|0},${75+Math.cos(seed)*10|0},${45+Math.sin(seed*2)*8|0})`;
  ctx.fillRect(x,y,s,s);
  const cx=x+s/2, cy=y+s/2, rng=i=>Math.sin(seed*19.1+i*7.3);
  const rg = ctx.createRadialGradient(cx-4,cy-4,2,cx,cy,s*0.38);
  rg.addColorStop(0,"#a0a0a0"); rg.addColorStop(0.6,"#707070"); rg.addColorStop(1,"#505050");
  ctx.fillStyle = rg;
  ctx.beginPath();
  ctx.moveTo(cx-s*0.3,cy+s*0.15);
  ctx.quadraticCurveTo(cx-s*0.35,cy-s*0.1,cx-s*0.15,cy-s*0.28);
  ctx.quadraticCurveTo(cx+s*0.05,cy-s*0.35,cx+s*0.2,cy-s*0.22);
  ctx.quadraticCurveTo(cx+s*0.38,cy-s*0.05,cx+s*0.3,cy+s*0.18);
  ctx.quadraticCurveTo(cx,cy+s*0.28,cx-s*0.3,cy+s*0.15);
  ctx.fill();
  ctx.strokeStyle = "rgba(40,40,40,0.3)"; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(cx-4,cy-6); ctx.lineTo(cx+2,cy+2); ctx.lineTo(cx+8,cy-1); ctx.stroke();
  ctx.fillStyle = "rgba(80,140,60,0.4)";
  ctx.beginPath(); ctx.arc(cx+s*0.12,cy+s*0.1,4,0,Math.PI*2); ctx.fill();
  if (rng(88)>0.3) {
    const mx=cx+rng(55)*12, my=cy+s*0.12;
    ctx.fillStyle = "#f5f5dc"; ctx.fillRect(mx-1,my,2,5);
    ctx.fillStyle = rng(66)>0?"#cc3333":"#dda520";
    ctx.beginPath(); ctx.arc(mx,my,4,Math.PI,Math.PI*2); ctx.fill();
    ctx.fillStyle = "#fff"; ctx.beginPath(); ctx.arc(mx-1.5,my-2,1,0,Math.PI*2); ctx.fill();
  }
}

function drawMagicBolt(ctx, x, y, time, hue, big) {
  const r = big ? 18 : 12;
  const gl = ctx.createRadialGradient(x,y,0,x,y,r);
  gl.addColorStop(0,`hsla(${hue},100%,90%,0.9)`);
  gl.addColorStop(0.4,`hsla(${hue},100%,60%,0.5)`);
  gl.addColorStop(1,"rgba(255,255,200,0)");
  ctx.fillStyle = gl; ctx.beginPath(); ctx.arc(x,y,r,0,Math.PI*2); ctx.fill();
  ctx.fillStyle = "#fff";
  for (let i=0;i<4;i++) {
    const a=time*0.01+(i/4)*Math.PI*2;
    ctx.beginPath(); ctx.arc(x+Math.cos(a)*(big?5:3),y+Math.sin(a)*(big?5:3),1.5,0,Math.PI*2); ctx.fill();
  }
}

// ─── Component ───────────────────────────────────────────────────────────────
export default function NanuPikaAdventures() {
  const canvasRef = useRef(null);
  const gameRef = useRef(null);
  const frameRef = useRef(null);
  const [selectedTier, setSelectedTier] = useState(0);
  const [ui, setUi] = useState({
    gold: START_GOLD, lives: START_LIVES, level: 1, phase: "prep",
    antsLeft: 0, score: 0, towerCount: 0, levelGold: START_GOLD,
  });

  const initGame = useCallback((lvl = 1, gold = START_GOLD) => {
    const { grid, path } = generatePath(lvl);
    const seedGrid = Array.from({ length: ROWS }, (_, r) =>
      Array.from({ length: COLS }, (_, c) => r * COLS + c + Math.random() * 100));
    gameRef.current = {
      grid, path, towers: [], ants: [], projectiles: [], particles: [],
      gold, lives: START_LIVES, level: lvl, phase: "prep",
      score: 0, spawnTimer: 0, spawned: 0, waveSize: scaleWave(lvl),
      lastTick: performance.now(), seedGrid, hoverCell: null,
      levelStartGold: gold, levelGrid: grid.map(r => [...r]), levelPath: [...path],
      levelSeedGrid: seedGrid.map(r => [...r]),
    };
    setUi({ gold, lives: START_LIVES, level: lvl, phase: "prep",
      antsLeft: scaleWave(lvl), score: 0, towerCount: 0, levelGold: gold });
  }, []);

  const restartLevel = useCallback(() => {
    const g = gameRef.current;
    if (!g || g.phase === "wave") return;
    g.towers = [];
    g.gold = g.levelStartGold;
    g.ants = []; g.projectiles = []; g.particles = [];
    g.grid = g.levelGrid.map(r => [...r]);
    g.path = [...g.levelPath];
    g.seedGrid = g.levelSeedGrid.map(r => [...r]);
    g.phase = "prep"; g.spawned = 0; g.spawnTimer = 0;
    setUi(s => ({ ...s, gold: g.levelStartGold, phase: "prep",
      antsLeft: g.waveSize, towerCount: 0 }));
  }, []);

  useEffect(() => { initGame(); }, [initGame]);

  const placeTower = useCallback((row, col) => {
    const g = gameRef.current;
    if (!g || g.phase === "gameover") return;
    if (g.grid[row][col] !== FOREST) return;
    if (g.towers.some(t => t.row === row && t.col === col)) return;
    const tier = TIERS[selectedTier];
    const cost = scaleCost(tier, g.level);
    if (g.gold < cost) return;
    g.gold -= cost;
    g.towers.push({
      row, col, tierId: tier.id, tierIdx: selectedTier,
      dmg: scaleDmg(tier, g.level), range: tier.range,
      cooldown: tier.cooldown, splash: tier.splash,
      lastFired: 0, state: "idle", attackTimer: 0, target: null,
      id: Date.now() + Math.random(), hue: tier.hueBase + Math.floor(Math.random()*30 - 15),
    });
    setUi(s => ({ ...s, gold: g.gold, towerCount: g.towers.length }));
  }, [selectedTier]);

  const startWave = useCallback(() => {
    const g = gameRef.current;
    if (!g || g.phase !== "prep") return;
    g.phase = "wave"; g.spawned = 0; g.spawnTimer = 0; g.ants = []; g.projectiles = [];
    setUi(s => ({ ...s, phase: "wave" }));
  }, []);

  const handleClick = useCallback((e) => {
    const canvas = canvasRef.current;
    if (!canvas || !gameRef.current) return;
    const rect = canvas.getBoundingClientRect();
    const col = Math.floor((e.clientX - rect.left) * (canvas.width / rect.width) / CELL);
    const row = Math.floor((e.clientY - rect.top) * (canvas.height / rect.height) / CELL);
    if (row >= 0 && row < ROWS && col >= 0 && col < COLS) placeTower(row, col);
  }, [placeTower]);

  const handleMove = useCallback((e) => {
    const canvas = canvasRef.current;
    if (!canvas || !gameRef.current) return;
    const rect = canvas.getBoundingClientRect();
    const col = Math.floor((e.clientX - rect.left) * (canvas.width / rect.width) / CELL);
    const row = Math.floor((e.clientY - rect.top) * (canvas.height / rect.height) / CELL);
    gameRef.current.hoverCell = (row >= 0 && row < ROWS && col >= 0 && col < COLS) ? { row, col } : null;
  }, []);

  // ─── Game Loop ─────────────────────────────────────────────────────────────
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");

    function tick(now) {
      const g = gameRef.current;
      if (!g) { frameRef.current = requestAnimationFrame(tick); return; }
      const dt = Math.min(now - g.lastTick, 100);
      g.lastTick = now;

      if (g.phase === "wave") {
        // Spawn
        g.spawnTimer -= dt;
        if (g.spawnTimer <= 0 && g.spawned < g.waveSize) {
          g.spawnTimer = scaleSpawn(g.level);
          g.ants.push({
            t: 0, hp: scaleHp(g.level), maxHp: scaleHp(g.level),
            id: now + Math.random(), speed: scaleSpeed(g.level) * (0.85 + Math.random()*0.3),
            dead: false, deathTime: 0, variant: Math.random()*100, slow: 0,
          });
          g.spawned++;
        }

        // Move
        for (const ant of g.ants) {
          if (ant.dead) { ant.deathTime += dt; continue; }
          const speedMul = ant.slow > 0 ? 0.5 : 1;
          ant.t += ant.speed * speedMul * (dt / 16);
          if (ant.slow > 0) ant.slow -= dt;
          if (ant.t >= g.path.length - 1) {
            ant.dead = true; ant.deathTime = 999;
            g.lives = Math.max(0, g.lives - 1);
          }
        }

        // Tower attack
        for (const tower of g.towers) {
          if (tower.state === "attack") {
            tower.attackTimer += dt;
            if (tower.attackTimer > 300) { tower.state = "idle"; tower.target = null; }
            continue;
          }
          if (now - tower.lastFired < tower.cooldown) continue;

          let closest = null, cDist = Infinity;
          for (const ant of g.ants) {
            if (ant.dead) continue;
            const pos = lerpPath(g.path, ant.t);
            const d = dist(pos, tower);
            if (d <= tower.range && d < cDist) { closest = ant; cDist = d; }
          }

          if (closest) {
            tower.lastFired = now; tower.state = "attack"; tower.attackTimer = 0;
            const pos = lerpPath(g.path, closest.t);
            tower.target = { row: pos.row, col: pos.col };
            const hitX = pos.col * CELL + CELL/2, hitY = pos.row * CELL + CELL/2;

            g.projectiles.push({
              sx: tower.col*CELL+CELL/2, sy: tower.row*CELL+CELL/2,
              tx: hitX, ty: hitY, t: 0, hue: tower.hue,
              big: tower.splash > 0,
            });

            // Apply damage
            closest.hp -= tower.dmg;

            // Frostclaw slows
            if (tower.tierId === "frostclaw") closest.slow = 800;

            // Splash damage
            if (tower.splash > 0) {
              for (const ant2 of g.ants) {
                if (ant2.dead || ant2 === closest) continue;
                const p2 = lerpPath(g.path, ant2.t);
                const d2x = (p2.col - pos.col) * CELL, d2y = (p2.row - pos.row) * CELL;
                if (Math.sqrt(d2x*d2x + d2y*d2y) < tower.splash * CELL) {
                  ant2.hp -= Math.floor(tower.dmg * 0.5);
                  if (ant2.hp <= 0 && !ant2.dead) {
                    ant2.dead = true; ant2.deathTime = 0;
                    g.gold += scaleReward(g.level);
                    g.score += 10 + g.level * 3;
                  }
                }
              }
            }

            // Particles
            for (let i = 0; i < 8; i++) {
              const a = Math.random()*Math.PI*2, sp = 1+Math.random()*3;
              g.particles.push({ x: hitX, y: hitY, vx: Math.cos(a)*sp, vy: Math.sin(a)*sp,
                life: 500, maxLife: 500, size: 2+Math.random()*3,
                hue: closest.hp <= 0 ? 0 : tower.hue + 60, type: closest.hp <= 0 ? "death" : "hit" });
            }

            if (closest.hp <= 0 && !closest.dead) {
              closest.dead = true; closest.deathTime = 0;
              g.gold += scaleReward(g.level);
              g.score += 10 + g.level * 3;
              for (let i = 0; i < 12; i++) {
                const a = (i/12)*Math.PI*2;
                g.particles.push({ x: hitX, y: hitY, vx: Math.cos(a)*2.5, vy: Math.sin(a)*2.5,
                  life: 700, maxLife: 700, size: 3, hue: 30, type: "death" });
              }
            }
          }
        }

        // Projectiles & particles
        for (const p of g.projectiles) p.t += dt / 150;
        g.projectiles = g.projectiles.filter(p => p.t < 1);
        for (const p of g.particles) { p.x += p.vx*(dt/16); p.y += p.vy*(dt/16); p.vy += 0.05*(dt/16); p.life -= dt; }
        g.particles = g.particles.filter(p => p.life > 0);
        g.ants = g.ants.filter(a => !(a.dead && a.deathTime > 600));

        // Wave end
        if (g.spawned >= g.waveSize && (g.ants.length === 0 || g.ants.every(a => a.dead))) {
          if (g.lives <= 0) {
            g.phase = "gameover";
            setUi(s => ({ ...s, phase: "gameover", lives: 0, gold: g.gold, score: g.score }));
          } else {
            const nextLvl = g.level + 1;
            const bonus = waveBonus(g.level);
            g.gold += bonus;
            const { grid, path } = generatePath(nextLvl);
            g.grid = grid; g.path = path; g.level = nextLvl;
            g.phase = "prep"; g.waveSize = scaleWave(nextLvl);
            g.ants = []; g.particles = []; g.projectiles = [];
            g.towers = g.towers.filter(t => grid[t.row]?.[t.col] === FOREST);
            const seedGrid = Array.from({ length: ROWS }, (_, r) =>
              Array.from({ length: COLS }, (_, c) => r*COLS+c+Math.random()*100));
            g.seedGrid = seedGrid;
            g.levelStartGold = g.gold;
            g.levelGrid = grid.map(r => [...r]);
            g.levelPath = [...path];
            g.levelSeedGrid = seedGrid.map(r => [...r]);
            setUi({ gold: g.gold, lives: g.lives, level: nextLvl, phase: "prep",
              antsLeft: g.waveSize, score: g.score, towerCount: g.towers.length, levelGold: g.gold });
          }
        } else {
          const alive = g.ants.filter(a => !a.dead).length;
          setUi(s => ({ ...s, gold: g.gold, lives: g.lives,
            antsLeft: g.waveSize - g.spawned + alive, score: g.score }));
        }
      }

      // ── DRAW ────────────────────────────────────────────────────────
      ctx.clearRect(0, 0, W, H);
      for (let r = 0; r < ROWS; r++) {
        for (let c = 0; c < COLS; c++) {
          const x = c*CELL, y = r*CELL, tile = g.grid[r][c], seed = g.seedGrid[r][c];
          if (tile === ROAD) {
            drawRoadTile(ctx, x, y, CELL, seed, {
              up: r > 0 && g.grid[r-1][c] === ROAD,
              down: r < ROWS-1 && g.grid[r+1][c] === ROAD
            });
          } else if (tile === OBSTACLE) { drawObstacleTile(ctx, x, y, CELL, seed); }
          else { drawForestTile(ctx, x, y, CELL, seed, now); }
          ctx.strokeStyle = "rgba(0,0,0,0.06)"; ctx.strokeRect(x, y, CELL, CELL);
        }
      }

      // Hover
      const tier = TIERS[selectedTier];
      if (g.hoverCell && g.phase !== "gameover") {
        const {row: hr, col: hc} = g.hoverCell;
        const canPlace = g.grid[hr][hc] === FOREST &&
          !g.towers.some(t => t.row === hr && t.col === hc) &&
          g.gold >= scaleCost(tier, g.level);
        ctx.fillStyle = canPlace ? "rgba(100,255,100,0.2)" : "rgba(255,60,60,0.15)";
        ctx.fillRect(hc*CELL, hr*CELL, CELL, CELL);
        if (canPlace) {
          ctx.strokeStyle = `${tier.color}44`; ctx.lineWidth = 1.5; ctx.setLineDash([4,4]);
          ctx.beginPath(); ctx.arc(hc*CELL+CELL/2, hr*CELL+CELL/2, tier.range*CELL, 0, Math.PI*2); ctx.stroke();
          ctx.setLineDash([]); ctx.lineWidth = 1;
          ctx.globalAlpha = 0.3;
          drawCatWizard(ctx, hc*CELL+CELL/2, hr*CELL+CELL/2+6, CELL*0.7, "idle", now, tier.hueBase, tier.id);
          ctx.globalAlpha = 1;
        }
      }

      // Projectiles
      for (const p of g.projectiles) {
        const ease = 1 - (1-p.t)*(1-p.t);
        const px = p.sx + (p.tx-p.sx)*ease;
        const py = p.sy + (p.ty-p.sy)*ease - Math.sin(ease*Math.PI)*25;
        drawMagicBolt(ctx, px, py, now, p.hue+60, p.big);
      }

      // Ants
      for (const ant of g.ants) {
        if (ant.dead) continue;
        const pos = lerpPath(g.path, ant.t);
        // Slow indicator
        if (ant.slow > 0) {
          ctx.fillStyle = "rgba(100,200,255,0.15)";
          ctx.beginPath(); ctx.arc(pos.col*CELL+CELL/2, pos.row*CELL+CELL/2, 16, 0, Math.PI*2); ctx.fill();
        }
        drawAnt(ctx, pos.col*CELL+CELL/2, pos.row*CELL+CELL/2, CELL*0.55, ant.hp, ant.maxHp, now, ant.variant);
      }

      // Towers
      for (const tower of g.towers) {
        drawCatWizard(ctx, tower.col*CELL+CELL/2, tower.row*CELL+CELL/2+6, CELL*0.7,
          tower.state === "attack" ? "attack" : "idle", now, tower.hue, tower.tierId);
        ctx.strokeStyle = `hsla(${tower.hue},60%,70%,0.05)`; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.arc(tower.col*CELL+CELL/2, tower.row*CELL+CELL/2, tower.range*CELL, 0, Math.PI*2); ctx.stroke();
      }

      // Particles
      for (const p of g.particles) {
        const alpha = p.life / p.maxLife;
        ctx.fillStyle = p.type === "death" ? `hsla(${p.hue},90%,55%,${alpha})` : `hsla(${p.hue},100%,70%,${alpha})`;
        ctx.beginPath(); ctx.arc(p.x, p.y, p.size*alpha, 0, Math.PI*2); ctx.fill();
      }

      // Game over
      if (g.phase === "gameover") {
        ctx.fillStyle = "rgba(10,5,20,0.7)"; ctx.fillRect(0,0,W,H);
        const vig = ctx.createRadialGradient(W/2,H/2,H*0.3,W/2,H/2,W*0.6);
        vig.addColorStop(0,"rgba(0,0,0,0)"); vig.addColorStop(1,"rgba(0,0,0,0.5)");
        ctx.fillStyle = vig; ctx.fillRect(0,0,W,H);
        ctx.textAlign = "center"; ctx.textBaseline = "middle";
        ctx.fillStyle = "#ff6b6b"; ctx.font = "bold 52px 'Trebuchet MS',sans-serif";
        ctx.fillText("Game Over!", W/2, H/2-35);
        ctx.fillStyle = "#e0d0b0"; ctx.font = "22px 'Trebuchet MS',sans-serif";
        ctx.fillText(`Score: ${g.score}  ·  Reached Level ${g.level}`, W/2, H/2+15);
        ctx.fillStyle = "#aaa"; ctx.font = "16px 'Trebuchet MS',sans-serif";
        ctx.fillText("Click Restart to try again", W/2, H/2+50);
      }

      frameRef.current = requestAnimationFrame(tick);
    }
    frameRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frameRef.current);
  }, [selectedTier]);

  const currentTier = TIERS[selectedTier];
  const cost = gameRef.current ? scaleCost(currentTier, gameRef.current.level) : currentTier.baseCost;
  const dmg = gameRef.current ? scaleDmg(currentTier, gameRef.current.level) : currentTier.dmg;

  const btnBase = {
    padding: "7px 20px", fontSize: "13px", fontWeight: 700,
    border: "none", borderRadius: "8px", cursor: "pointer",
    transition: "transform 0.1s, box-shadow 0.1s",
  };

  return (
    <div style={{
      display: "flex", flexDirection: "column", alignItems: "center",
      background: "linear-gradient(160deg, #0d1117 0%, #161b22 40%, #1a2332 100%)",
      minHeight: "100vh", fontFamily: "'Trebuchet MS','Lucida Sans',sans-serif",
      color: "#c9d1d9", padding: "10px 8px", userSelect: "none",
    }}>
      <h1 style={{
        fontSize: "24px", fontWeight: 800, margin: "0 0 4px 0",
        background: "linear-gradient(90deg,#ff7eb3,#ff758c,#ff9a56,#ffd700,#56ffa4,#7ee8fa)",
        backgroundSize: "200% 100%", animation: "shimmer 4s ease-in-out infinite",
        WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", letterSpacing: "1.5px",
      }}>
        🐱 Nanu & Pika Adventures 🧙‍♂️
      </h1>

      {/* HUD */}
      <div style={{
        display: "flex", gap: "14px", alignItems: "center", marginBottom: "5px",
        fontSize: "13px", flexWrap: "wrap", justifyContent: "center",
        background: "rgba(255,255,255,0.04)", borderRadius: "10px", padding: "5px 14px",
      }}>
        <span style={{ color: "#ffd700", fontWeight: 700 }}>💰 {ui.gold}g</span>
        <span style={{ color: "#ff6b6b", fontWeight: 700 }}>❤️ {ui.lives}</span>
        <span style={{ color: "#79c0ff" }}>📊 Lv.{ui.level}</span>
        <span style={{ color: "#c9a96e" }}>🐜 ×{ui.antsLeft}</span>
        <span style={{ color: "#7ee87e" }}>⭐ {ui.score}</span>
        <span style={{ color: "#888", fontSize: "11px" }}>
          🏰 {ui.towerCount} placed
        </span>
      </div>

      {/* Tower Tier Selector */}
      <div style={{
        display: "flex", gap: "6px", marginBottom: "5px", flexWrap: "wrap", justifyContent: "center",
      }}>
        {TIERS.map((t, i) => {
          const c = scaleCost(t, ui.level);
          const d = scaleDmg(t, ui.level);
          const active = i === selectedTier;
          const affordable = ui.gold >= c;
          return (
            <button key={t.id} onClick={() => setSelectedTier(i)}
              style={{
                padding: "5px 10px", fontSize: "11px", fontWeight: active ? 800 : 500,
                background: active
                  ? `linear-gradient(135deg, ${t.color}33, ${t.color}18)`
                  : "rgba(255,255,255,0.04)",
                color: affordable ? t.color : "#555",
                border: active ? `2px solid ${t.color}88` : "2px solid transparent",
                borderRadius: "8px", cursor: "pointer",
                transition: "all 0.15s", minWidth: "120px", textAlign: "left",
                opacity: affordable ? 1 : 0.6,
              }}>
              <div style={{ fontSize: "13px" }}>{t.emoji} {t.name}</div>
              <div style={{ fontSize: "10px", color: "#888", marginTop: "1px" }}>
                {c}g · {d}dmg · {t.range.toFixed(1)}r
                {t.splash > 0 && " · 💥"}
                {t.id === "frostclaw" && " · 🧊"}
              </div>
              <div style={{ fontSize: "9px", color: "#666", marginTop: "1px" }}>{t.desc}</div>
            </button>
          );
        })}
      </div>

      {/* Action Buttons */}
      <div style={{ display: "flex", gap: "8px", marginBottom: "5px", flexWrap: "wrap", justifyContent: "center" }}>
        {ui.phase === "prep" && (
          <>
            <button onClick={startWave} style={{
              ...btnBase, background: "linear-gradient(135deg,#43e97b,#38f9d7)", color: "#0d1117",
              boxShadow: "0 2px 16px rgba(67,233,123,0.25)",
            }}>
              ⚔️ Send Wave {ui.level}
            </button>
            <button onClick={restartLevel} style={{
              ...btnBase, background: "rgba(255,255,255,0.08)", color: "#aaa",
            }}>
              🔄 Restart Level
            </button>
          </>
        )}
        {ui.phase === "gameover" && (
          <button onClick={() => initGame()} style={{
            ...btnBase, background: "linear-gradient(135deg,#f093fb,#f5576c)", color: "#fff",
          }}>
            🔄 New Game
          </button>
        )}
        {ui.phase === "wave" && (
          <div style={{
            padding: "7px 18px", fontSize: "12px",
            background: "rgba(255,255,255,0.06)", borderRadius: "8px",
            animation: "pulse 1.8s ease-in-out infinite",
          }}>
            ⚡ Wave in progress...
          </div>
        )}
      </div>

      {/* Canvas */}
      <canvas ref={canvasRef} width={W} height={H}
        onClick={handleClick} onMouseMove={handleMove}
        style={{
          borderRadius: "10px", border: "2px solid rgba(255,255,255,0.08)",
          boxShadow: "0 4px 40px rgba(0,0,0,0.6)", cursor: "crosshair", maxWidth: "100%",
        }}
      />

      {/* Legend */}
      <div style={{
        marginTop: "6px", fontSize: "11px", color: "#555", textAlign: "center",
        maxWidth: "750px", lineHeight: 1.5, display: "flex", gap: "12px",
        flexWrap: "wrap", justifyContent: "center",
      }}>
        <span>🟢 Forest = placeable</span>
        <span>🟤 Road = ant path</span>
        <span>⬛ Rock = blocked</span>
        <span>🔄 Restart Level resets gold & towers</span>
        <span>💰 +{waveBonus(ui.level)}g wave bonus</span>
      </div>

      <style>{`
        @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.5} }
        @keyframes shimmer { 0%{background-position:0% 50%} 50%{background-position:100% 50%} 100%{background-position:0% 50%} }
      `}</style>
    </div>
  );
}
