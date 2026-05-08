const { posterPalette } = require('./poster-layout');

const DEFAULT_WIDTH = 750;
const DEFAULT_HEIGHT = 1334;

function setFont(ctx, size, weight) {
  ctx.font = `${weight || 400} ${size}px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif`;
}

function roundRect(ctx, x, y, width, height, radius) {
  const r = Math.min(radius, width / 2, height / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + width - r, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + r);
  ctx.lineTo(x + width, y + height - r);
  ctx.quadraticCurveTo(x + width, y + height, x + width - r, y + height);
  ctx.lineTo(x + r, y + height);
  ctx.quadraticCurveTo(x, y + height, x, y + height - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

function fillRoundRect(ctx, x, y, width, height, radius, fillStyle) {
  roundRect(ctx, x, y, width, height, radius);
  ctx.fillStyle = fillStyle;
  ctx.fill();
}

function strokeRoundRect(ctx, x, y, width, height, radius, strokeStyle) {
  roundRect(ctx, x, y, width, height, radius);
  ctx.strokeStyle = strokeStyle;
  ctx.stroke();
}

function wrapText(ctx, text, maxWidth, maxLines) {
  const source = String(text || '');
  const lines = [];
  let line = '';
  for (let i = 0; i < source.length; i += 1) {
    const next = line + source[i];
    if (ctx.measureText(next).width > maxWidth && line) {
      lines.push(line);
      line = source[i];
      if (maxLines && lines.length >= maxLines) break;
    } else {
      line = next;
    }
  }
  if ((!maxLines || lines.length < maxLines) && line) lines.push(line);
  if (maxLines && lines.length > maxLines) lines.length = maxLines;
  if (maxLines && lines.length === maxLines && ctx.measureText(lines[lines.length - 1]).width > maxWidth) {
    let last = lines[lines.length - 1];
    while (last.length > 1 && ctx.measureText(`${last}…`).width > maxWidth) last = last.slice(0, -1);
    lines[lines.length - 1] = `${last}…`;
  }
  return lines;
}

function drawWrapped(ctx, text, x, y, maxWidth, lineHeight, maxLines) {
  const lines = wrapText(ctx, text, maxWidth, maxLines);
  lines.forEach((line, index) => ctx.fillText(line, x, y + index * lineHeight));
  return lines.length * lineHeight;
}

function renderToCanvas(ctx, model, options) {
  const width = (options && options.width) || model.width || DEFAULT_WIDTH;
  const height = (options && options.height) || model.height || DEFAULT_HEIGHT;
  const palette = model.palette || posterPalette('dark');

  const gradient = ctx.createLinearGradient(0, 0, 0, height);
  gradient.addColorStop(0, palette.backgroundTop || '#0b2f5b');
  gradient.addColorStop(1, palette.backgroundBottom || '#211433');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, width, height);

  ctx.fillStyle = 'rgba(255,255,255,0.05)';
  ctx.beginPath();
  ctx.arc(width - 80, 120, 190, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(80, 430, 130, 0, Math.PI * 2);
  ctx.fill();

  const margin = 56;
  let y = 72;

  setFont(ctx, 28, 700);
  ctx.fillStyle = palette.primary;
  ctx.fillText('CLOUD SEA FORECAST LAB', margin, y);
  y += 56;

  setFont(ctx, 56, 800);
  ctx.fillStyle = palette.text;
  drawWrapped(ctx, model.location || '当前位置', margin, y, width - margin * 2 - 150, 64, 2);

  const badgeText = model.badge || '☁️ 云海';
  setFont(ctx, 24, 700);
  const badgeWidth = Math.min(180, ctx.measureText(badgeText).width + 42);
  fillRoundRect(ctx, width - margin - badgeWidth, 100, badgeWidth, 52, 26, palette.primarySoft || 'rgba(58,164,255,0.16)');
  ctx.fillStyle = palette.primary;
  ctx.textAlign = 'center';
  ctx.fillText(badgeText, width - margin - badgeWidth / 2, 134);
  ctx.textAlign = 'left';

  y += 116;
  setFont(ctx, 28, 400);
  ctx.fillStyle = palette.textSecondary;
  ctx.fillText(model.date || '', margin, y);

  y += 64;
  fillRoundRect(ctx, margin, y, width - margin * 2, 258, 32, palette.card || 'rgba(255,255,255,0.10)');
  strokeRoundRect(ctx, margin, y, width - margin * 2, 258, 32, palette.cardBorder || 'rgba(173,199,255,0.18)');
  setFont(ctx, 30, 600);
  ctx.fillStyle = palette.textSecondary;
  ctx.fillText(model.predictionType + '综合评分', margin + 36, y + 52);
  setFont(ctx, 106, 900);
  ctx.fillStyle = palette.primary;
  ctx.fillText(model.scoreText || '--', margin + 34, y + 162);
  setFont(ctx, 34, 700);
  ctx.fillStyle = palette.text;
  ctx.fillText('/100', margin + 190, y + 154);
  setFont(ctx, 28, 600);
  ctx.fillStyle = palette.warning;
  ctx.fillText(model.confidence || '置信度：待更新', margin + 36, y + 214);
  setFont(ctx, 28, 500);
  ctx.fillStyle = palette.textSecondary;
  drawWrapped(ctx, model.summary || '', margin + 310, y + 92, width - margin * 2 - 350, 40, 3);

  y += 304;
  const kpis = (model.kpis || []).slice(0, 4);
  const gap = 20;
  const cellWidth = (width - margin * 2 - gap) / 2;
  const cellHeight = 128;
  kpis.forEach((item, index) => {
    const x = margin + (index % 2) * (cellWidth + gap);
    const cy = y + Math.floor(index / 2) * (cellHeight + gap);
    fillRoundRect(ctx, x, cy, cellWidth, cellHeight, 24, 'rgba(255,255,255,0.08)');
    setFont(ctx, 24, 500);
    ctx.fillStyle = palette.textSecondary;
    ctx.fillText(item.label, x + 24, cy + 42);
    setFont(ctx, 38, 800);
    ctx.fillStyle = item.color || palette.text;
    ctx.fillText(String(item.value || '--'), x + 24, cy + 92);
  });

  y += 2 * cellHeight + gap + 48;
  const reasons = (model.reasons || []).slice(0, 5);
  if (reasons.length) {
    setFont(ctx, 32, 800);
    ctx.fillStyle = palette.text;
    ctx.fillText('推荐理由', margin, y);
    y += 38;
    setFont(ctx, 25, 400);
    reasons.forEach((reason, index) => {
      fillRoundRect(ctx, margin, y, width - margin * 2, 64, 18, 'rgba(255,255,255,0.07)');
      ctx.fillStyle = palette.success;
      ctx.fillText(String(index + 1).padStart(2, '0'), margin + 22, y + 40);
      ctx.fillStyle = palette.text;
      drawWrapped(ctx, reason, margin + 72, y + 40, width - margin * 2 - 96, 30, 1);
      y += 78;
    });
    y += 20;
  }

  const hints = (model.hints || []).slice(0, 2);
  if (hints.length) {
    setFont(ctx, 32, 800);
    ctx.fillStyle = palette.text;
    ctx.fillText('推荐机位', margin, y);
    y += 42;
    setFont(ctx, 25, 400);
    hints.forEach(hint => {
      ctx.fillStyle = palette.textSecondary;
      const used = drawWrapped(ctx, `📍 ${hint}`, margin, y, width - margin * 2, 32, 2);
      y += used + 14;
    });
  }

  const qrSize = 118;
  const footerY = height - 174;
  strokeRoundRect(ctx, margin, footerY, qrSize, qrSize, 18, palette.cardBorder || 'rgba(173,199,255,0.18)');
  setFont(ctx, 22, 500);
  ctx.fillStyle = palette.textMuted;
  ctx.textAlign = 'center';
  ctx.fillText('QR', margin + qrSize / 2, footerY + 70);
  ctx.textAlign = 'left';
  setFont(ctx, 28, 800);
  ctx.fillStyle = palette.text;
  ctx.fillText(model.footer || 'CloudSeaShell · 云海决策台', margin + qrSize + 28, footerY + 44);
  setFont(ctx, 22, 400);
  ctx.fillStyle = palette.textSecondary;
  drawWrapped(ctx, '预测仅供参考，请结合现场天气与安全条件', margin + qrSize + 28, footerY + 82, width - margin * 2 - qrSize - 28, 30, 2);

  return { width, height };
}

module.exports = { renderToCanvas, wrapText };
