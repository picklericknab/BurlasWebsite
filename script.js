const canvas = document.getElementById('tree-canvas');
const ctx = canvas.getContext('2d');
const nodeInput = document.getElementById('node-input');
const insertBtn = document.getElementById('insert-btn');
const randomBtn = document.getElementById('random-btn');
const undoBtn = document.getElementById('undo-btn');
const clearBtn = document.getElementById('clear-btn');
const errorMsg = document.getElementById('error-msg');
const emptyMsg = document.getElementById('empty-msg');
const opLog = document.getElementById('op-log');
const infoStatus = document.getElementById('info-status');
const infoRoot = document.getElementById('info-root');
const infoCount = document.getElementById('info-count');
const infoHeight = document.getElementById('info-height');
const themeToggle = document.getElementById('theme-toggle');

const NODE_R = 22;
const V_GAP = 64;
const ANIM_DURATION = 420;

let root = null;
let nodeCount = 0;
let history = [];
let animatingNode = null;
let animStart = null;
let animPath = [];
let animDone = false;
let rafId = null;

function makeNode(val) {
  return { val, left: null, right: null };
}

function insert(node, val) {
  if (!node) return makeNode(val);
  if (val < node.val) node.left = insert(node.left, val);
  else if (val > node.val) node.right = insert(node.right, val);
  return node;
}

function contains(node, val) {
  if (!node) return false;
  if (val === node.val) return true;
  if (val < node.val) return contains(node.left, val);
  return contains(node.right, val);
}

function treeHeight(node) {
  if (!node) return 0;
  return 1 + Math.max(treeHeight(node.left), treeHeight(node.right));
}

function getPathTo(node, val, path) {
  if (!node) return false;
  path.push({ x: node._x, y: node._y });
  if (val === node.val) return true;
  if (val < node.val) return getPathTo(node.left, val, path);
  return getPathTo(node.right, val, path);
}

function assignPositions(node, depth, left, right) {
  if (!node) return;
  node._x = (left + right) / 2;
  node._y = depth * V_GAP + NODE_R * 2 + 10;
  assignPositions(node.left, depth + 1, left, (left + right) / 2);
  assignPositions(node.right, depth + 1, (left + right) / 2, right);
}

function getCanvasWidth() {
  return canvas.parentElement.clientWidth || 600;
}

function getTreeBounds(node, bounds) {
  if (!node) return;
  if (node._x < bounds.minX) bounds.minX = node._x;
  if (node._x > bounds.maxX) bounds.maxX = node._x;
  if (node._y > bounds.maxY) bounds.maxY = node._y;
  getTreeBounds(node.left, bounds);
  getTreeBounds(node.right, bounds);
}

function prepareCanvas() {
  const cw = getCanvasWidth();
  assignPositions(root, 0, 0, cw);
  if (!root) {
    canvas.width = cw;
    canvas.height = 320;
    return;
  }
  const bounds = { minX: Infinity, maxX: -Infinity, maxY: -Infinity };
  getTreeBounds(root, bounds);
  const h = Math.max(320, bounds.maxY + NODE_R * 2 + 20);
  canvas.width = cw;
  canvas.height = h;
}

function getCSSVar(name) {
  return getComputedStyle(document.body).getPropertyValue(name).trim();
}

function drawEdges(node) {
  if (!node) return;
  ctx.strokeStyle = getCSSVar('--edge');
  ctx.lineWidth = 1.5;
  if (node.left) {
    ctx.beginPath();
    ctx.moveTo(node._x, node._y);
    ctx.lineTo(node.left._x, node.left._y);
    ctx.stroke();
    drawEdges(node.left);
  }
  if (node.right) {
    ctx.beginPath();
    ctx.moveTo(node._x, node._y);
    ctx.lineTo(node.right._x, node.right._y);
    ctx.stroke();
    drawEdges(node.right);
  }
}

function drawNodes(node, highlightVal) {
  if (!node) return;
  const isNew = animDone && node.val === highlightVal;
  const fill = isNew ? getCSSVar('--node-new-fill') : getCSSVar('--node-fill');
  const stroke = isNew ? getCSSVar('--node-new-stroke') : getCSSVar('--node-stroke');
  ctx.beginPath();
  ctx.arc(node._x, node._y, NODE_R, 0, Math.PI * 2);
  ctx.fillStyle = fill;
  ctx.fill();
  ctx.strokeStyle = stroke;
  ctx.lineWidth = isNew ? 2.5 : 1.5;
  ctx.stroke();
  ctx.fillStyle = getCSSVar('--node-text');
  ctx.font = `13px 'Courier New', monospace`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(String(node.val), node._x, node._y);
  drawNodes(node.left, highlightVal);
  drawNodes(node.right, highlightVal);
}

function drawAnimBall(progress) {
  if (!animPath || animPath.length < 2) return;
  const totalSegs = animPath.length - 1;
  const pos = progress * totalSegs;
  const seg = Math.min(Math.floor(pos), totalSegs - 1);
  const t = pos - seg;
  const a = animPath[seg];
  const b = animPath[seg + 1];
  const cx = a.x + (b.x - a.x) * t;
  const cy = a.y + (b.y - a.y) * t;
  ctx.beginPath();
  ctx.arc(cx, cy, NODE_R * 0.55, 0, Math.PI * 2);
  ctx.fillStyle = getCSSVar('--node-new-stroke');
  ctx.globalAlpha = 0.7;
  ctx.fill();
  ctx.globalAlpha = 1;
}

function render(highlightVal) {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  drawEdges(root);
  drawNodes(root, highlightVal);
}

function animateInsert(val, onDone) {
  animPath = [];
  getPathTo(root, val, animPath);
  animStart = null;
  animDone = false;

  function step(ts) {
    if (!animStart) animStart = ts;
    const elapsed = ts - animStart;
    const progress = Math.min(elapsed / ANIM_DURATION, 1);
    render(null);
    drawAnimBall(progress);
    if (progress < 1) {
      rafId = requestAnimationFrame(step);
    } else {
      animDone = true;
      render(val);
      setTimeout(() => {
        animDone = false;
        render(null);
        onDone();
      }, 500);
    }
  }
  rafId = requestAnimationFrame(step);
}

function updateInfo() {
  const empty = !root;
  infoStatus.textContent = empty ? 'Empty' : 'Not Empty';
  infoRoot.textContent = empty ? '—' : root.val;
  infoCount.textContent = nodeCount;
  infoHeight.textContent = treeHeight(root);
  emptyMsg.style.display = empty ? 'block' : 'none';
}

function addLog(text, type) {
  const li = document.createElement('li');
  li.textContent = text;
  li.className = type;
  opLog.insertBefore(li, opLog.firstChild);
  while (opLog.children.length > 30) opLog.removeChild(opLog.lastChild);
}

function showError(msg) {
  errorMsg.textContent = msg;
  errorMsg.classList.remove('hidden');
  setTimeout(() => errorMsg.classList.add('hidden'), 2500);
}

function doInsert(val) {
  if (isNaN(val) || val === null || val === '') {
    showError('Please enter a valid number.');
    return;
  }
  val = parseInt(val, 10);
  if (val < -9999 || val > 9999) {
    showError('Value must be between -9999 and 9999.');
    return;
  }
  if (contains(root, val)) {
    showError('Value ' + val + ' already exists in the tree.');
    return;
  }

  if (rafId) cancelAnimationFrame(rafId);

  root = insert(root, val);
  nodeCount++;
  history.push(val);

  prepareCanvas();
  render(null);
  addLog('Inserted ' + val, 'insert');
  updateInfo();

  animateInsert(val, () => {});
}

insertBtn.addEventListener('click', () => {
  const v = nodeInput.value.trim();
  doInsert(v);
  nodeInput.value = '';
  nodeInput.focus();
});

nodeInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') insertBtn.click();
});

randomBtn.addEventListener('click', () => {
  const val = Math.floor(Math.random() * 199) - 99;
  doInsert(val);
});

clearBtn.addEventListener('click', () => {
  if (rafId) cancelAnimationFrame(rafId);
  root = null;
  nodeCount = 0;
  history = [];
  animDone = false;
  prepareCanvas();
  render(null);
  updateInfo();
  addLog('Tree cleared', 'clear');
});

undoBtn.addEventListener('click', () => {
  if (history.length === 0) {
    showError('Nothing to undo.');
    return;
  }
  if (rafId) cancelAnimationFrame(rafId);

  const removed = history.pop();

  root = null;
  nodeCount = 0;
  for (const v of history) {
    root = insert(root, v);
    nodeCount++;
  }

  prepareCanvas();
  render(null);
  updateInfo();
  addLog('Undo: removed ' + removed, 'undo');
});

themeToggle.addEventListener('click', () => {
  document.body.classList.toggle('light');
  themeToggle.textContent = document.body.classList.contains('light') ? '☀' : '☾';
  render(null);
});

window.addEventListener('resize', () => {
  prepareCanvas();
  render(null);
});

prepareCanvas();
render(null);
updateInfo();