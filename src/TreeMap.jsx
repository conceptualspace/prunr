import React, { useState, useEffect, useLayoutEffect, useCallback, useMemo, useRef } from 'react';
import { createPortal } from 'react-dom';
import {
  Stack,
  Text,
  Group,
  Button,
  Progress,
  Paper,
  Breadcrumbs,
  Anchor,
  Tooltip,
  ActionIcon,
  SegmentedControl,
} from '@mantine/core';
import {
  IconFolderPlus,
  IconCancel,
  IconChartTreemap,
  IconChartDonut3,
  IconFolder,
  IconExternalLink,
  IconTrash,
  IconInfoCircle,
} from '@tabler/icons-react';

function formatSize(bytes) {
  if (bytes === 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${(bytes / Math.pow(1024, i)).toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
}

// Squarified treemap layout
function squarify(children, x, y, w, h) {
  if (!children || children.length === 0) return [];

  const total = children.reduce((s, c) => s + c.size, 0);
  if (total === 0) return [];

  const rects = [];
  let remaining = [...children];
  let cx = x, cy = y, cw = w, ch = h;

  while (remaining.length > 0) {
    const isWide = cw >= ch;
    const side = isWide ? ch : cw;
    const totalRemaining = remaining.reduce((s, c) => s + c.size, 0);

    // Find best row
    let row = [remaining[0]];
    let rowArea = (remaining[0].size / totalRemaining) * cw * ch;

    const worstRatio = (row) => {
      const rowTotal = row.reduce((s, c) => s + c.size, 0);
      const rowFraction = rowTotal / totalRemaining;
      const rowSide = isWide ? cw * rowFraction : ch * rowFraction;
      let worst = 0;
      for (const item of row) {
        const frac = item.size / rowTotal;
        const itemSide = side * frac;
        const ratio = rowSide > itemSide ? rowSide / itemSide : itemSide / rowSide;
        if (ratio > worst) worst = ratio;
      }
      return worst;
    };

    for (let i = 1; i < remaining.length; i++) {
      const candidate = [...row, remaining[i]];
      if (worstRatio(candidate) <= worstRatio(row)) {
        row = candidate;
      } else {
        break;
      }
    }

    // Layout the row
    const rowTotal = row.reduce((s, c) => s + c.size, 0);
    const rowFraction = rowTotal / totalRemaining;
    let px = cx, py = cy;

    if (isWide) {
      const rowWidth = cw * rowFraction;
      for (const item of row) {
        const itemHeight = side * (item.size / rowTotal);
        rects.push({ ...item, x: px, y: py, w: rowWidth, h: itemHeight });
        py += itemHeight;
      }
      cx += rowWidth;
      cw -= rowWidth;
    } else {
      const rowHeight = ch * rowFraction;
      for (const item of row) {
        const itemWidth = side * (item.size / rowTotal);
        rects.push({ ...item, x: px, y: py, w: itemWidth, h: rowHeight });
        px += itemWidth;
      }
      cy += rowHeight;
      ch -= rowHeight;
    }

    remaining = remaining.slice(row.length);
  }

  return rects;
}

const DEPTH_COLORS = [
  '#4c6ef5', '#7048e8', '#ae3ec9', '#d6336c', '#e8590c',
  '#f59f00', '#37b24d', '#1098ad', '#4263eb', '#845ef7',
];

const EXT_COLORS = {
  '.jpg': '#e8590c', '.jpeg': '#e8590c', '.png': '#d6336c', '.gif': '#ae3ec9',
  '.webp': '#f06595', '.svg': '#f76707', '.bmp': '#e67700', '.ico': '#fd7e14',
  '.mp4': '#7048e8', '.mkv': '#845ef7', '.avi': '#9c36b5', '.mov': '#862e9c',
  '.webm': '#5f3dc4', '.flv': '#7950f2',
  '.mp3': '#1098ad', '.wav': '#0c8599', '.flac': '#099268', '.aac': '#0ca678',
  '.js': '#f59f00', '.jsx': '#fab005', '.ts': '#15aabf', '.tsx': '#1098ad',
  '.py': '#37b24d', '.go': '#1098ad', '.rs': '#e8590c', '.java': '#d6336c',
  '.json': '#868e96', '.xml': '#868e96', '.yaml': '#868e96', '.toml': '#868e96',
  '.css': '#ae3ec9', '.scss': '#9c36b5', '.html': '#e8590c', '.htm': '#e8590c',
  '.zip': '#495057', '.tar': '#495057', '.gz': '#495057', '.rar': '#495057',
  '.pdf': '#c92a2a', '.doc': '#364fc7', '.docx': '#364fc7', '.txt': '#868e96',
};

function getColor(node, depth) {
  if (node.children) {
    return DEPTH_COLORS[depth % DEPTH_COLORS.length];
  }
  const ext = (node.name || '').includes('.') ? '.' + node.name.split('.').pop().toLowerCase() : '';
  return EXT_COLORS[ext] || '#495057';
}

function hitTest(rects, x, y, padding) {
  for (let i = rects.length - 1; i >= 0; i--) {
    const r = rects[i];
    const rx = r.x + padding, ry = r.y + padding;
    const rw = r.w - padding * 2, rh = r.h - padding * 2;
    if (x >= rx && x <= rx + rw && y >= ry && y <= ry + rh) return r;
  }
  return null;
}

function drawTreemap(ctx, rects, hoveredRect, padding, dpr) {
  ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);

  for (const rect of rects) {
    const color = getColor(rect, 0);
    const isDir = !!rect.children;
    const isHovered = rect === hoveredRect;
    const rx = rect.x + padding, ry = rect.y + padding;
    const innerW = Math.max(0, rect.w - padding * 2);
    const innerH = Math.max(0, rect.h - padding * 2);

    if (innerW < 1 || innerH < 1) continue;

    ctx.globalAlpha = isHovered ? 0.9 : 0.7;
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.roundRect(rx, ry, innerW, innerH, 3);
    ctx.fill();
    ctx.globalAlpha = 1;

    const showLabel = innerW > 40 && innerH > 16;
    const showSize = innerW > 60 && innerH > 30;

    if (showLabel) {
      const maxChars = Math.floor(innerW / 7);
      const label = rect.name.length > maxChars
        ? rect.name.slice(0, maxChars - 1) + '\u2026'
        : rect.name;
      ctx.fillStyle = '#fff';
      ctx.font = `${isDir ? 'bold ' : ''}10px monospace`;
      ctx.fillText(label, rx + 4, ry + 13, innerW - 8);
    }

    if (showSize) {
      ctx.fillStyle = 'rgba(255,255,255,0.7)';
      ctx.font = '10px monospace';
      ctx.fillText(formatSize(rect.size), rx + 4, ry + 26, innerW - 8);
    }
  }
}

// Sunburst layout
// Minimum arc sweep in radians to be individually visible (~1.1 degrees)
const MIN_ARC_SWEEP = 0.02;

function computeArcs(node, startAngle, endAngle, depth, maxDepth) {
  const arcs = [];
  if (node.size === 0) return arcs;
  arcs.push({ ...node, startAngle, endAngle, depth });
  if (node.children && node.children.length > 0 && depth < maxDepth) {
    const total = node.children.reduce((s, c) => s + c.size, 0);
    if (total > 0) {
      let angle = startAngle;
      const span = endAngle - startAngle;
      const sorted = [...node.children].sort((a, b) => b.size - a.size);
      let othersSize = 0;
      let othersCount = 0;
      for (const child of sorted) {
        const sweep = (child.size / total) * span;
        if (sweep >= MIN_ARC_SWEEP) {
          arcs.push(...computeArcs(child, angle, angle + sweep, depth + 1, maxDepth));
          angle += sweep;
        } else {
          othersSize += child.size;
          othersCount++;
        }
      }
      if (othersCount > 0 && othersSize > 0) {
        const othersSweep = (othersSize / total) * span;
        arcs.push({
          name: `${othersCount} other items`,
          size: othersSize,
          path: node.path,
          startAngle: angle,
          endAngle: angle + othersSweep,
          depth: depth + 1,
          _isOthers: true,
        });
      }
    }
  }
  return arcs;
}

function hitTestSunburst(arcs, mx, my, cx, cy, ringWidth, baseRadius) {
  const dx = mx - cx;
  const dy = my - cy;
  const r = Math.sqrt(dx * dx + dy * dy);
  let angle = Math.atan2(dy, dx);
  if (angle < -Math.PI / 2) angle += Math.PI * 2;
  for (let i = arcs.length - 1; i >= 0; i--) {
    const arc = arcs[i];
    if (arc.depth === 0) continue;
    const innerR = baseRadius + (arc.depth - 1) * ringWidth;
    const outerR = baseRadius + arc.depth * ringWidth;
    if (r < innerR || r > outerR) continue;
    if (angle >= arc.startAngle && angle <= arc.endAngle) return arc;
  }
  return null;
}

function drawSunburst(ctx, arcs, hoveredArc, cx, cy, ringWidth, baseRadius) {
  ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
  const gap = 0.004;
  for (const arc of arcs) {
    if (arc.depth === 0) continue;
    const innerR = baseRadius + (arc.depth - 1) * ringWidth;
    const outerR = baseRadius + arc.depth * ringWidth;
    const sa = arc.startAngle + gap;
    const ea = arc.endAngle - gap;
    if (ea <= sa) continue;
    const isHovered = arc === hoveredArc;
    ctx.globalAlpha = isHovered ? 0.95 : 0.75;
    ctx.fillStyle = arc._isOthers ? '#555' : getColor(arc, arc.depth);
    ctx.beginPath();
    ctx.arc(cx, cy, outerR, sa, ea);
    ctx.arc(cx, cy, innerR, ea, sa, true);
    ctx.closePath();
    ctx.fill();
    const sweep = ea - sa;
    const midR = (innerR + outerR) / 2;
    const arcLen = sweep * midR;
    if (arcLen > 50 && ringWidth > 18) {
      const midAngle = (sa + ea) / 2;
      const tx = cx + midR * Math.cos(midAngle);
      const ty = cy + midR * Math.sin(midAngle);
      ctx.save();
      ctx.translate(tx, ty);
      let rot = midAngle;
      if (rot > Math.PI / 2 && rot < 3 * Math.PI / 2) rot += Math.PI;
      ctx.rotate(rot);
      ctx.globalAlpha = 1;
      ctx.fillStyle = '#fff';
      ctx.font = '10px monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      const sizeLabel = formatSize(arc.size);
      const maxChars = Math.floor(arcLen / 7);
      const label = sizeLabel.length > maxChars ? sizeLabel.slice(0, maxChars - 1) + '\u2026' : sizeLabel;
      ctx.fillText(label, 0, 0);
      ctx.restore();
    }
    ctx.globalAlpha = 1;
  }
  ctx.fillStyle = 'rgba(30, 30, 30, 0.9)';
  ctx.beginPath();
  ctx.arc(cx, cy, baseRadius - 2, 0, Math.PI * 2);
  ctx.fill();
  const root = arcs.find(a => a.depth === 0);
  if (root) {
    ctx.fillStyle = '#fff';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = 'bold 11px monospace';
    const maxW = (baseRadius - 10) * 2;
    const maxChars = Math.floor(maxW / 7);
    const label = root.name.length > maxChars ? root.name.slice(0, maxChars - 1) + '\u2026' : root.name;
    ctx.fillText(label, cx, cy - 8);
    ctx.font = '10px monospace';
    ctx.fillStyle = 'rgba(255,255,255,0.7)';
    ctx.fillText(formatSize(root.size), cx, cy + 8);
  }
}

function TreeMapView({ tree, onNavigate, onDelete }) {
  const containerRef = useRef(null);
  const canvasRef = useRef(null);
  const tooltipRef = useRef(null);
  const [dims, setDims] = useState({ width: 800, height: 500 });
  const [contextMenu, setContextMenu] = useState(null);
  const contextMenuRef = useRef(null);
  const rectsRef = useRef([]);
  const hoveredRef = useRef(null);
  const padding = 2;

  useLayoutEffect(() => {
    if (contextMenu && contextMenuRef.current) {
      const el = contextMenuRef.current;
      const rect = el.getBoundingClientRect();
      let x = contextMenu.x;
      let y = contextMenu.y;
      if (x + rect.width > window.innerWidth) x = window.innerWidth - rect.width - 4;
      if (y + rect.height > window.innerHeight) y = window.innerHeight - rect.height - 4;
      
      x = Math.max(4, x);
      y = Math.max(4, y);
      
      el.style.left = `${x}px`;
      el.style.top = `${y}px`;
    }
  }, [contextMenu]);

  const closeContextMenu = useCallback(() => setContextMenu(null), []);

  useEffect(() => {
    if (!containerRef.current) return;
    const obs = new ResizeObserver((entries) => {
      const { width, height } = entries[0].contentRect;
      setDims((prev) =>
        prev.width === width && prev.height === height ? prev : { width, height }
      );
    });
    obs.observe(containerRef.current);
    return () => obs.disconnect();
  }, []);

  const rects = useMemo(() => {
    if (!tree?.children?.length) return [];
    return squarify(tree.children, 0, 0, dims.width, dims.height);
  }, [tree, dims]);

  // Keep ref in sync for event handlers
  rectsRef.current = rects;

  // Draw on canvas whenever rects change
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = dims.width * dpr;
    canvas.height = dims.height * dpr;
    const ctx = canvas.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    hoveredRef.current = null;
    drawTreemap(ctx, rects, null, padding, dpr);
  }, [rects, dims]);

  const getCanvasPos = useCallback((e) => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const bounds = canvas.getBoundingClientRect();
    return { x: e.clientX - bounds.left, y: e.clientY - bounds.top };
  }, []);

  const redraw = useCallback((hovered) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dpr = window.devicePixelRatio || 1;
    const ctx = canvas.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    drawTreemap(ctx, rectsRef.current, hovered, padding, dpr);
  }, []);

  const handleMouseMove = useCallback((e) => {
    const pos = getCanvasPos(e);
    if (!pos) return;

    const hit = hitTest(rectsRef.current, pos.x, pos.y, padding);
    const prev = hoveredRef.current;

    if (hit !== prev) {
      hoveredRef.current = hit;
      redraw(hit);

      const canvas = canvasRef.current;
      if (canvas) canvas.style.cursor = hit?.children ? 'pointer' : 'default';
    }

    const tt = tooltipRef.current;
    if (hit) {
      tt.querySelector('.tt-name').textContent = (hit.children ? '\u{1F4C1} ' : '') + hit.name;
      tt.querySelector('.tt-detail').textContent =
        formatSize(hit.size) + (hit.children ? ` \u00B7 ${hit.children.length} items` : '');
      // Place offscreen first so the browser lays it out at full size before we measure
      tt.style.left = '-9999px';
      tt.style.top = '-9999px';
      tt.style.display = 'block';
    } else if (tt) {
      tt.style.display = 'none';
    }

    if (tt && tt.style.display !== 'none') {
      const ttRect = tt.getBoundingClientRect();
      let left = e.clientX + 12;
      let top = e.clientY - 8;
      if (left + ttRect.width > window.innerWidth) left = e.clientX - ttRect.width - 12;
      if (top + ttRect.height > window.innerHeight) top = e.clientY - ttRect.height - 8;
      left = Math.max(4, left);
      top = Math.max(4, top);
      tt.style.left = `${left}px`;
      tt.style.top = `${top}px`;
    }
  }, [getCanvasPos, redraw]);

  const handleMouseLeave = useCallback(() => {
    if (hoveredRef.current) {
      hoveredRef.current = null;
      redraw(null);
    }
    const tt = tooltipRef.current;
    if (tt) tt.style.display = 'none';
  }, [redraw]);

  const handleClick = useCallback((e) => {
    const pos = getCanvasPos(e);
    if (!pos) return;
    const hit = hitTest(rectsRef.current, pos.x, pos.y, padding);
    if (hit?.children) onNavigate(hit);
  }, [getCanvasPos, onNavigate]);

  const handleContextMenu = useCallback((e) => {
    e.preventDefault();
    const pos = getCanvasPos(e);
    if (!pos) return;
    const hit = hitTest(rectsRef.current, pos.x, pos.y, padding);
    if (hit) setContextMenu({ x: e.clientX, y: e.clientY, rect: hit });
  }, [getCanvasPos]);

  return (
    <div ref={containerRef} style={{ flex: 1, position: 'relative', overflow: 'hidden' }}>
      <canvas
        ref={canvasRef}
        style={{ display: 'block', width: dims.width, height: dims.height }}
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
        onClick={handleClick}
        onContextMenu={handleContextMenu}
      />
      {createPortal(
        <div
          ref={tooltipRef}
          style={{
            display: 'none',
            position: 'fixed',
            background: 'rgba(0,0,0,0.85)',
            color: '#fff',
            padding: '6px 10px',
            borderRadius: 6,
            fontSize: 12,
            fontFamily: 'monospace',
            pointerEvents: 'none',
            zIndex: 1000,
            maxWidth: 400,
            overflow: 'hidden',
          }}
        >
          <div className="tt-name" style={{ fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}></div>
          <div className="tt-detail" style={{ color: 'rgba(255,255,255,0.7)', whiteSpace: 'nowrap' }}></div>
        </div>,
        document.body
      )}
      {contextMenu && createPortal(
        <>
          <style>{`
            .tm-ctx-item {
              display: flex; align-items: center; gap: 8px;
              padding: 6px 12px; width: 100%; font-size: 13px;
              color: #c1c2c5; cursor: pointer; border: none;
              background: none; border-radius: 4px; font-family: inherit;
            }
            .tm-ctx-item:hover { background: var(--mantine-color-dark-5); }
          `}</style>
          <div
            style={{ position: 'fixed', inset: 0, zIndex: 999 }}
            onClick={closeContextMenu}
            onContextMenu={(e) => { e.preventDefault(); closeContextMenu(); }}
          />
          <Paper
            ref={contextMenuRef}
            shadow="lg"
            p={4}
            style={{
              position: 'fixed',
              left: contextMenu.x,
              top: contextMenu.y,
              zIndex: 1000,
              minWidth: 180,
              background: 'var(--mantine-color-dark-7)',
              border: '1px solid var(--mantine-color-dark-4)',
            }}
          >
            <button className="tm-ctx-item" onClick={() => { window.api.showItemInFolder(contextMenu.rect.path); closeContextMenu(); }}>
              <IconFolder size={14} /> Open File Location
            </button>
            {!contextMenu.rect.children && (
              <button className="tm-ctx-item" onClick={() => { window.api.openFile(contextMenu.rect.path); closeContextMenu(); }}>
                <IconExternalLink size={14} /> Open with Default App
              </button>
            )}
            <button className="tm-ctx-item" onClick={async () => {
              const p = contextMenu.rect.path;
              closeContextMenu();
              try {
                await window.api.trashFile(p);
                onDelete?.(p);
              } catch (err) {
                console.error("Failed to delete item:", err);
              }
            }}>
              <IconTrash size={14} /> Delete
            </button>
          </Paper>
        </>,
        document.body
      )}
    </div>
  );
}

function SunburstView({ tree, onNavigate, onDelete }) {
  const containerRef = useRef(null);
  const canvasRef = useRef(null);
  const tooltipRef = useRef(null);
  const [dims, setDims] = useState({ width: 800, height: 500 });
  const [contextMenu, setContextMenu] = useState(null);
  const contextMenuRef = useRef(null);
  const arcsRef = useRef([]);
  const hoveredRef = useRef(null);
  const maxDepth = 7;

  useLayoutEffect(() => {
    if (contextMenu && contextMenuRef.current) {
      const el = contextMenuRef.current;
      const rect = el.getBoundingClientRect();
      let x = contextMenu.x;
      let y = contextMenu.y;
      if (x + rect.width > window.innerWidth) x = window.innerWidth - rect.width - 4;
      if (y + rect.height > window.innerHeight) y = window.innerHeight - rect.height - 4;
      x = Math.max(4, x);
      y = Math.max(4, y);
      el.style.left = `${x}px`;
      el.style.top = `${y}px`;
    }
  }, [contextMenu]);

  const closeContextMenu = useCallback(() => setContextMenu(null), []);

  useEffect(() => {
    if (!containerRef.current) return;
    const obs = new ResizeObserver((entries) => {
      const { width, height } = entries[0].contentRect;
      setDims((prev) =>
        prev.width === width && prev.height === height ? prev : { width, height }
      );
    });
    obs.observe(containerRef.current);
    return () => obs.disconnect();
  }, []);

  const layout = useMemo(() => {
    const cx = dims.width / 2;
    const cy = dims.height / 2;
    const maxR = Math.min(cx, cy) - 20;
    const baseRadius = Math.max(40, maxR * 0.15);
    const ringWidth = (maxR - baseRadius) / maxDepth;
    return { cx, cy, baseRadius, ringWidth };
  }, [dims]);

  const arcs = useMemo(() => {
    if (!tree?.children?.length) return [];
    return computeArcs(tree, -Math.PI / 2, 3 * Math.PI / 2, 0, maxDepth);
  }, [tree]);

  arcsRef.current = arcs;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = dims.width * dpr;
    canvas.height = dims.height * dpr;
    const ctx = canvas.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    hoveredRef.current = null;
    drawSunburst(ctx, arcs, null, layout.cx, layout.cy, layout.ringWidth, layout.baseRadius);
  }, [arcs, dims, layout]);

  const getCanvasPos = useCallback((e) => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const bounds = canvas.getBoundingClientRect();
    return { x: e.clientX - bounds.left, y: e.clientY - bounds.top };
  }, []);

  const redraw = useCallback((hovered) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dpr = window.devicePixelRatio || 1;
    const ctx = canvas.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    drawSunburst(ctx, arcsRef.current, hovered, layout.cx, layout.cy, layout.ringWidth, layout.baseRadius);
  }, [layout]);

  const handleMouseMove = useCallback((e) => {
    const pos = getCanvasPos(e);
    if (!pos) return;
    const hit = hitTestSunburst(arcsRef.current, pos.x, pos.y, layout.cx, layout.cy, layout.ringWidth, layout.baseRadius);
    const prev = hoveredRef.current;
    if (hit !== prev) {
      hoveredRef.current = hit;
      redraw(hit);
      const canvas = canvasRef.current;
      if (canvas) canvas.style.cursor = hit?.children ? 'pointer' : 'default';
    }
    const tt = tooltipRef.current;
    if (hit) {
      tt.querySelector('.tt-name').textContent = (hit.children ? '\u{1F4C1} ' : '') + hit.name;
      tt.querySelector('.tt-detail').textContent = hit._isOthers
        ? formatSize(hit.size)
        : formatSize(hit.size) + (hit.children ? ` \u00B7 ${hit.children.length} items \u00B7 depth ${hit.depth}` : ` \u00B7 depth ${hit.depth}`);
      tt.style.left = '-9999px';
      tt.style.top = '-9999px';
      tt.style.display = 'block';
    } else if (tt) {
      tt.style.display = 'none';
    }
    if (tt && tt.style.display !== 'none') {
      const ttRect = tt.getBoundingClientRect();
      let left = e.clientX + 12;
      let top = e.clientY - 8;
      if (left + ttRect.width > window.innerWidth) left = e.clientX - ttRect.width - 12;
      if (top + ttRect.height > window.innerHeight) top = e.clientY - ttRect.height - 8;
      left = Math.max(4, left);
      top = Math.max(4, top);
      tt.style.left = `${left}px`;
      tt.style.top = `${top}px`;
    }
  }, [getCanvasPos, redraw, layout]);

  const handleMouseLeave = useCallback(() => {
    if (hoveredRef.current) {
      hoveredRef.current = null;
      redraw(null);
    }
    const tt = tooltipRef.current;
    if (tt) tt.style.display = 'none';
  }, [redraw]);

  const handleClick = useCallback((e) => {
    const pos = getCanvasPos(e);
    if (!pos) return;
    const hit = hitTestSunburst(arcsRef.current, pos.x, pos.y, layout.cx, layout.cy, layout.ringWidth, layout.baseRadius);
    if (hit?.children) onNavigate(hit);
  }, [getCanvasPos, layout, onNavigate]);

  const handleContextMenu = useCallback((e) => {
    e.preventDefault();
    const pos = getCanvasPos(e);
    if (!pos) return;
    const hit = hitTestSunburst(arcsRef.current, pos.x, pos.y, layout.cx, layout.cy, layout.ringWidth, layout.baseRadius);
    if (hit) setContextMenu({ x: e.clientX, y: e.clientY, rect: hit });
  }, [getCanvasPos, layout]);

  return (
    <div ref={containerRef} style={{ flex: 1, position: 'relative', overflow: 'hidden' }}>
      <canvas
        ref={canvasRef}
        style={{ display: 'block', width: dims.width, height: dims.height }}
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
        onClick={handleClick}
        onContextMenu={handleContextMenu}
      />
      {createPortal(
        <div
          ref={tooltipRef}
          style={{
            display: 'none',
            position: 'fixed',
            background: 'rgba(0,0,0,0.85)',
            color: '#fff',
            padding: '6px 10px',
            borderRadius: 6,
            fontSize: 12,
            fontFamily: 'monospace',
            pointerEvents: 'none',
            zIndex: 1000,
            maxWidth: 400,
            overflow: 'hidden',
          }}
        >
          <div className="tt-name" style={{ fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}></div>
          <div className="tt-detail" style={{ color: 'rgba(255,255,255,0.7)', whiteSpace: 'nowrap' }}></div>
        </div>,
        document.body
      )}
      {contextMenu && createPortal(
        <>
          <style>{`
            .sb-ctx-item {
              display: flex; align-items: center; gap: 8px;
              padding: 6px 12px; width: 100%; font-size: 13px;
              color: #c1c2c5; cursor: pointer; border: none;
              background: none; border-radius: 4px; font-family: inherit;
            }
            .sb-ctx-item:hover { background: var(--mantine-color-dark-5); }
          `}</style>
          <div
            style={{ position: 'fixed', inset: 0, zIndex: 999 }}
            onClick={closeContextMenu}
            onContextMenu={(e) => { e.preventDefault(); closeContextMenu(); }}
          />
          <Paper
            ref={contextMenuRef}
            shadow="lg"
            p={4}
            style={{
              position: 'fixed',
              left: contextMenu.x,
              top: contextMenu.y,
              zIndex: 1000,
              minWidth: 180,
              background: 'var(--mantine-color-dark-7)',
              border: '1px solid var(--mantine-color-dark-4)',
            }}
          >
            {contextMenu.rect._isOthers ? (
              <button className="sb-ctx-item" onClick={() => { window.api.openFile(contextMenu.rect.path); closeContextMenu(); }}>
                <IconFolder size={14} /> Open Parent Folder
              </button>
            ) : (
              <>
                <button className="sb-ctx-item" onClick={() => { window.api.showItemInFolder(contextMenu.rect.path); closeContextMenu(); }}>
                  <IconFolder size={14} /> Open File Location
                </button>
                {!contextMenu.rect.children && (
                  <button className="sb-ctx-item" onClick={() => { window.api.openFile(contextMenu.rect.path); closeContextMenu(); }}>
                    <IconExternalLink size={14} /> Open with Default App
                  </button>
                )}
                <button className="sb-ctx-item" onClick={async () => {
                  const p = contextMenu.rect.path;
                  closeContextMenu();
                  try {
                    await window.api.trashFile(p);
                    onDelete?.(p);
                  } catch (err) {
                    console.error("Failed to delete item:", err);
                  }
                }}>
                  <IconTrash size={14} /> Delete
                </button>
              </>
            )}
          </Paper>
        </>,
        document.body
      )}
    </div>
  );
}

export default function TreeMap({ toolbarTarget }) {
  const [directory, setDirectory] = useState(null);
  const [scanning, setScanning] = useState(false);
  const [progress, setProgress] = useState({});
  const [tree, setTree] = useState(null);
  const [breadcrumb, setBreadcrumb] = useState([]);
  const [chartType, setChartType] = useState('treemap');

  useEffect(() => {
    const unsub1 = window.api.onTreemapProgress((data) => setProgress(data));
    const unsub2 = window.api.onTreemapComplete((data) => {
      setScanning(false);
      if (!data.cancelled && data.tree) {
        setTree(data.tree);
        setBreadcrumb([data.tree]);
      }
    });
    return () => { unsub1(); unsub2(); };
  }, []);

  const handleSelectDir = useCallback(async () => {
    const dir = await window.api.selectDirectory();
    if (!dir) return;
    setDirectory(dir);
    setScanning(true);
    setTree(null);
    setBreadcrumb([]);
    setProgress({});
    window.api.startTreemap(dir);
  }, []);

  const handleCancel = useCallback(() => {
    window.api.cancelTreemap();
    setScanning(false);
  }, []);

  const handleNavigate = useCallback((node) => {
    if (!node.children) return;
    setBreadcrumb((prev) => [...prev, node]);
  }, []);

  const handleBreadcrumbClick = useCallback((index) => {
    setBreadcrumb((prev) => prev.slice(0, index + 1));
  }, []);

  const handleDelete = useCallback((deletedPath) => {
    setBreadcrumb((prev) => {
      if (prev.length === 0) return prev;
      const current = prev[prev.length - 1];
      if (!current?.children) return prev;
      const child = current.children.find(c => c.path === deletedPath);
      if (!child) return prev;
      const removedSize = child.size;
      const next = [...prev];
      next[next.length - 1] = {
        ...current,
        size: current.size - removedSize,
        children: current.children.filter(c => c.path !== deletedPath),
      };
      for (let i = next.length - 2; i >= 0; i--) {
        const node = prev[i];
        const oldChild = prev[i + 1];
        const newChild = next[i + 1];
        next[i] = {
          ...node,
          size: node.size - removedSize,
          children: node.children.map(c => c === oldChild ? newChild : c),
        };
      }
      setTree(next[0]);
      return next;
    });
  }, []);

  const currentNode = breadcrumb.length > 0 ? breadcrumb[breadcrumb.length - 1] : null;

  const toolbarContent = (
    <>
      {breadcrumb.length > 0 && (
        <Group gap={4} style={{ flex: 1, minWidth: 0, overflow: 'hidden' }} wrap="nowrap">
          <Breadcrumbs separator="›" separatorMargin={4} style={{ flexWrap: 'nowrap', overflow: 'hidden' }}>
            {breadcrumb.map((node, i) => (
              i < breadcrumb.length - 1 ? (
                <Anchor
                  key={node.path}
                  size="sm"
                  c="dimmed"
                  onClick={() => handleBreadcrumbClick(i)}
                  style={{ fontFamily: 'monospace', cursor: 'pointer', whiteSpace: 'nowrap' }}
                >
                  {node.name}
                </Anchor>
              ) : (
                <Text key={node.path} size="sm" fw={600} style={{ fontFamily: 'monospace', whiteSpace: 'nowrap' }}>
                  {node.name}
                </Text>
              )
            ))}
          </Breadcrumbs>
          {currentNode && (
            <Text size="xs" c="dimmed" style={{ whiteSpace: 'nowrap', flexShrink: 0 }}>
               · {formatSize(currentNode.size)} · {currentNode.children?.length || 0} items
            </Text>
          )}
        </Group>
      )}
      {/* 
      {!scanning && tree && breadcrumb.length < 2 && (
        // legend
        <Group gap="sm" style={{ flexShrink: 0, paddingRight: 16 }} visibleFrom="lg">
          {[
            { label: 'Folders', color: '#4c6ef5' },
            { label: 'Images', color: '#e8590c' },
            { label: 'Video', color: '#7048e8' },
            { label: 'Audio', color: '#1098ad' },
            { label: 'Code', color: '#f59f00' },
            { label: 'Docs', color: '#868e96' },
            { label: 'Archives', color: '#495057' },
          ].map(item => (
            <Group key={item.label} gap={6}>
              <div style={{ width: 10, height: 10, borderRadius: '50%', backgroundColor: item.color }} />
              <Text size="xs" c="dimmed">{item.label}</Text>
            </Group>
          ))}
        </Group>
      )} 
      */}
      {!scanning && tree && (
        <SegmentedControl
          value={chartType}
          onChange={setChartType}
          size="md"
          style={{ flexShrink: 0 }}
          data={[
            { label: <Tooltip openDelay={300} label="Treemap" withArrow><Group gap={0}><IconChartTreemap size={18} stroke={1.5} /></Group></Tooltip>, value: 'treemap' },
            { label: <Tooltip openDelay={300} label="Sunburst" withArrow><Group gap={0}><IconChartDonut3 size={18} stroke={1.5} /></Group></Tooltip>, value: 'sunburst' },
          ]}
        />
      )}
      {scanning ? (
        <Button style={{ marginLeft: tree ? undefined : 'auto' }} variant="filled" leftSection={<IconCancel size={16} />} onClick={handleCancel}>
          Cancel
        </Button>
      ) : (
        <Button style={{ marginLeft: tree ? undefined : 'auto' }} leftSection={<IconFolderPlus size={16} />} onClick={handleSelectDir}>
          Scan Folder...
        </Button>
      )}
    </>
  );

  return (
    <Stack gap={0} style={{ height: '100%' }}>
      {toolbarTarget && createPortal(toolbarContent, toolbarTarget)}

      {/* Content area */}
      {scanning && (
        <Stack p="md" align="center" justify="center" style={{ flex: 1 }}>
          <Text fw={600}>Scanning directory…</Text>
          <Text c="dimmed" size="sm">{progress.fileCount || 0} files found</Text>
          <Progress value={100} animated style={{ width: 300 }} />
          <Text c="dimmed" size="xs" truncate="end" style={{ fontFamily: 'monospace', maxWidth: 500 }}>
            {progress.currentFile || ''}
          </Text>
        </Stack>
      )}

      {!scanning && !tree && (
        <Stack align="center" justify="center" style={{ flex: 1 }} p="xl">
          <IconChartTreemap size={48} stroke={1} style={{ color: 'var(--mantine-color-dimmed)' }} />
          <Text c="dimmed" size="lg" fw={500}>
            Select a directory to visualize disk usage.
          </Text>
          <Text c="dimmed" size="sm">
            Files and folders are displayed proportional to their size.
          </Text>
        </Stack>
      )}

      {!scanning && tree && currentNode && (
        <div style={{ flex: 1, position: 'relative', overflow: 'hidden' }}>
          <div style={{
            position: 'absolute',
            inset: 0,
            opacity: chartType === 'treemap' ? 1 : 0,
            transition: 'opacity 0.25s ease',
            pointerEvents: chartType === 'treemap' ? 'auto' : 'none',
            display: 'flex',
            flexDirection: 'column',
          }}>
            <TreeMapView tree={currentNode} onNavigate={handleNavigate} onDelete={handleDelete} />
          </div>
          <div style={{
            position: 'absolute',
            inset: 0,
            opacity: chartType === 'sunburst' ? 1 : 0,
            transition: 'opacity 0.25s ease',
            pointerEvents: chartType === 'sunburst' ? 'auto' : 'none',
            display: 'flex',
            flexDirection: 'column',
          }}>
            <SunburstView tree={currentNode} onNavigate={handleNavigate} onDelete={handleDelete} />
          </div>
        </div>
      )}
    </Stack>
  );
}
