/* Live Measure app.js
 - Calibrate with a known-width object (draw box) to compute mm per pixel
 - Optionally auto-detect large rectangles using OpenCV if available
 - Measure by tapping two points or drawing a rectangle
*/

const video = document.getElementById('video');
const overlay = document.getElementById('overlay');
const ctx = overlay.getContext('2d');
let stream = null;
let rafId = null;
let videoWidth = 640, videoHeight = 480;

const refWidthInput = document.getElementById('refWidth');
const startBtn = document.getElementById('startBtn');
const stopBtn = document.getElementById('stopBtn');
const calibrateBtn = document.getElementById('calibrateBtn');
const autoDetectBtn = document.getElementById('autoDetectBtn');
const pointBtn = document.getElementById('pointBtn');
const rectBtn = document.getElementById('rectBtn');
const clearBtn = document.getElementById('clearBtn');
const statusEl = document.getElementById('status');
const resultEl = document.getElementById('result');

let mode = null; // 'calibrate', 'point', 'rect'
let isDrawing = false;
let startX = 0, startY = 0;
let points = [];
let pxPerMM = null;
let autoDetectEnabled = false;

function setStatus(s){ statusEl.textContent = 'Status: ' + s; }
function setResult(s){ resultEl.textContent = s; }

startBtn.addEventListener('click', startCamera);
stopBtn.addEventListener('click', stopCamera);
calibrateBtn.addEventListener('click', ()=>{ mode='calibrate'; setStatus('calibrate: draw reference box on video'); enableCanvasInteraction(true); });
autoDetectBtn.addEventListener('click', startAutoDetect);
pointBtn.addEventListener('click', ()=>{ mode='point'; points = []; setStatus('point mode: tap two points'); enableCanvasInteraction(true); });
rectBtn.addEventListener('click', ()=>{ mode='rect'; setStatus('rect mode: draw box to measure'); enableCanvasInteraction(true); });
clearBtn.addEventListener('click', clearMeasurements);

function startCamera(){
  navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' }, audio: false })
    .then(s => {
      stream = s;
      video.srcObject = stream;
      startBtn.disabled = true;
      stopBtn.disabled = false;
      setStatus('camera started');
      video.addEventListener('loadedmetadata', onVideoReady);
    })
    .catch(err => setStatus('camera error: ' + err.message));
}
function stopCamera(){
  if(stream){ stream.getTracks().forEach(t=>t.stop()); stream = null; }
  if(rafId) cancelAnimationFrame(rafId);
  startBtn.disabled = false; stopBtn.disabled = true;
  setStatus('camera stopped');
}

function onVideoReady(){
  videoWidth = video.videoWidth || 640;
  videoHeight = video.videoHeight || 480;
  overlay.width = videoWidth;
  overlay.height = videoHeight;
  overlay.style.width = video.clientWidth + 'px';
  overlay.style.height = video.clientHeight + 'px';
  drawLoop();
}

function drawLoop(){
  ctx.clearRect(0,0,overlay.width,overlay.height);

  // draw crosshair center
  ctx.strokeStyle = 'rgba(255,255,255,0.2)';
  ctx.beginPath();
  ctx.moveTo(overlay.width/2-10, overlay.height/2);
  ctx.lineTo(overlay.width/2+10, overlay.height/2);
  ctx.moveTo(overlay.width/2, overlay.height/2-10);
  ctx.lineTo(overlay.width/2, overlay.height/2+10);
  ctx.stroke();

  // draw reference and points
  ctx.lineWidth = 2;
  ctx.strokeStyle = '#0f0';
  if(window._lastRefBox){
    const b = window._lastRefBox;
    ctx.strokeStyle = 'rgba(0,200,0,0.9)';
    ctx.strokeRect(b.x, b.y, b.w, b.h);
    ctx.font = '14px sans-serif'; ctx.fillStyle = 'rgba(0,200,0,0.9)';
    ctx.fillText('Ref', b.x+4, b.y+16);
  }

  if(points.length>0){
    ctx.strokeStyle = '#ff0';
    ctx.beginPath();
    ctx.moveTo(points[0].x, points[0].y);
    for(let i=1;i<points.length;i++) ctx.lineTo(points[i].x, points[i].y);
    ctx.stroke();
    for(const p of points){ ctx.fillStyle='#ff0'; ctx.beginPath(); ctx.arc(p.x,p.y,6,0,Math.PI*2); ctx.fill(); }
  }

  // live measurement display: if pxPerMM known and two points
  if(pxPerMM && points.length>=2){
    const p0 = points[0], p1 = points[1];
    const dx = p1.x - p0.x, dy = p1.y - p0.y;
    const px = Math.hypot(dx,dy);
    const mm = px / pxPerMM;
    ctx.strokeStyle = '#0af'; ctx.fillStyle='#0af'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(p0.x,p0.y); ctx.lineTo(p1.x,p1.y); ctx.stroke();
    const midx = (p0.x+p1.x)/2, midy=(p0.y+p1.y)/2;
    ctx.font='18px sans-serif'; ctx.fillText(mm.toFixed(1)+' mm', midx+8, midy-8);
    setResult(mm.toFixed(1)+' mm');
  } else if(points.length>=2){
    setResult('px: ' + Math.round(Math.hypot(points[1].x-points[0].x, points[1].y-points[0].y)) + ' px');
  }

  // if autoDetect is on and OpenCV available, draw detected rect
  if(autoDetectEnabled && window.cv && video.readyState >= 2){
    // detection runs separately and updates window._autoDetectedBox
    if(window._autoDetectedBox){
      const b = window._autoDetectedBox;
      ctx.strokeStyle='rgba(255,0,80,0.9)'; ctx.lineWidth=2; ctx.strokeRect(b.x,b.y,b.w,b.h);
      ctx.font='14px sans-serif'; ctx.fillStyle='rgba(255,0,80,0.9)'; ctx.fillText('Auto', b.x+4, b.y+16);
      // if calibrated, compute width
      if(pxPerMM){
        const wmm = b.w / pxPerMM;
        ctx.fillText(wmm.toFixed(1)+' mm', b.x+4, b.y+36);
        setResult('Auto width: ' + wmm.toFixed(1) + ' mm');
      }
    }
  }

  rafId = requestAnimationFrame(drawLoop);
}

// Canvas interactions (for calibration and measurement)
function enableCanvasInteraction(enable){
  if(enable){
    overlay.style.pointerEvents = 'auto';
    overlay.addEventListener('mousedown', onDown);
    overlay.addEventListener('mousemove', onMove);
    overlay.addEventListener('mouseup', onUp);
    overlay.addEventListener('touchstart', onDown);
    overlay.addEventListener('touchmove', onMove);
    overlay.addEventListener('touchend', onUp);
  } else {
    overlay.style.pointerEvents = 'none';
    overlay.removeEventListener('mousedown', onDown);
    overlay.removeEventListener('mousemove', onMove);
    overlay.removeEventListener('mouseup', onUp);
    overlay.removeEventListener('touchstart', onDown);
    overlay.removeEventListener('touchmove', onMove);
    overlay.removeEventListener('touchend', onUp);
  }
}

function getPos(e){
  const rect = overlay.getBoundingClientRect();
  let clientX, clientY;
  if(e.touches && e.touches[0]){ clientX = e.touches[0].clientX; clientY = e.touches[0].clientY; }
  else { clientX = e.clientX; clientY = e.clientY; }
  const x = (clientX - rect.left) * (overlay.width / rect.width);
  const y = (clientY - rect.top) * (overlay.height / rect.height);
  return {x,y};
}

function onDown(e){ e.preventDefault(); isDrawing=true; const p=getPos(e); startX=p.x; startY=p.y; }
function onMove(e){ if(!isDrawing) return; e.preventDefault(); const p=getPos(e); if(mode==='calibrate' || mode==='rect'){ window._tempBox = { x: Math.min(startX,p.x), y: Math.min(startY,p.y), w: Math.abs(p.x-startX), h: Math.abs(p.y-startY) }; }
  else if(mode==='point'){ /* nothing during move */ }
}
function onUp(e){ if(!isDrawing) return; isDrawing=false; const p=getPos(e);
  if(mode==='calibrate'){
    const box = { x: Math.min(startX,p.x), y: Math.min(startY,p.y), w: Math.abs(p.x-startX), h: Math.abs(p.y-startY) };
    window._lastRefBox = box; // store for overlay
    // compute pixels per mm using ref width input and box width in px
    const refMM = parseFloat(refWidthInput.value) || 85.6;
    pxPerMM = box.w / refMM;
    setStatus('calibrated: ' + pxPerMM.toFixed(3) + ' px/mm');
    setResult('calibrated');
  } else if(mode==='rect'){
    const box = { x: Math.min(startX,p.x), y: Math.min(startY,p.y), w: Math.abs(p.x-startX), h: Math.abs(p.y-startY) };
    points = [ {x: box.x, y: box.y}, {x: box.x+box.w, y: box.y+box.h} ];
    setStatus('rectangle measured');
  } else if(mode==='point'){
    points.push(p);
    if(points.length>2) points.shift();
    if(points.length===2) setStatus('points selected');
  }
}

function clearMeasurements(){ points=[]; window._lastRefBox=null; pxPerMM=null; window._autoDetectedBox=null; setResult('cleared'); setStatus('idle'); }

// Auto detect using OpenCV (if loaded). We'll run detection on a downscaled canvas periodically.
let autoDetectInterval = null;
function startAutoDetect(){
  if(!window.cv){ setStatus('OpenCV not loaded - auto-detect unavailable'); return; }
  autoDetectEnabled = true; setStatus('auto-detect enabled');
  if(autoDetectInterval) clearInterval(autoDetectInterval);
  autoDetectInterval = setInterval(runAutoDetect, 800);
}

function runAutoDetect(){
  if(!video || video.readyState < 2) return;
  try{
    const w = 480;
    const h = Math.round(video.videoHeight * (w / video.videoWidth));
    const tmpCanvas = document.createElement('canvas'); tmpCanvas.width = w; tmpCanvas.height = h;
    const tctx = tmpCanvas.getContext('2d'); tctx.drawImage(video, 0, 0, w, h);
    const src = cv.imread(tmpCanvas);
    let gray = new cv.Mat(); cv.cvtColor(src, gray, cv.COLOR_RGBA2GRAY);
    let blurred = new cv.Mat(); cv.GaussianBlur(gray, blurred, new cv.Size(5,5), 0);
    let edges = new cv.Mat(); cv.Canny(blurred, edges, 50, 150);
    let contours = new cv.MatVector(); let hierarchy = new cv.Mat();
    cv.findContours(edges, contours, hierarchy, cv.RETR_LIST, cv.CHAIN_APPROX_SIMPLE);
    let maxArea = 0; let maxRect = null;
    for(let i=0;i<contours.size();i++){
      const cnt = contours.get(i);
      const peri = cv.arcLength(cnt, true);
      const approx = new cv.Mat(); cv.approxPolyDP(cnt, approx, 0.02*peri, true);
      if(approx.rows===4){
        const rect = cv.boundingRect(approx);
        const area = rect.width * rect.height;
        if(area > maxArea && rect.width > 20 && rect.height > 20){ maxArea = area; maxRect = rect; }
      }
      approx.delete(); cnt.delete();
    }
    // draw result scaled back to overlay size
    if(maxRect){
      const scaleX = overlay.width / w; const scaleY = overlay.height / h;
      window._autoDetectedBox = { x: maxRect.x * scaleX, y: maxRect.y * scaleY, w: maxRect.width * scaleX, h: maxRect.height * scaleY };
    } else { window._autoDetectedBox = null; }
    // cleanup
    src.delete(); gray.delete(); blurred.delete(); edges.delete(); contours.delete(); hierarchy.delete();
  }catch(err){ console.error('auto detect error', err); setStatus('auto-detect error'); }
}

// Quick quality: if user closes page, stop camera
window.addEventListener('pagehide', stopCamera);
window.addEventListener('beforeunload', stopCamera);

// initial status
setStatus('idle');
setResult('No measurement');

// Small helper: if OpenCV loads after page, show status
function waitForOpenCV(){ if(window.cv) { console.log('OpenCV loaded'); setStatus('OpenCV loaded'); } else setTimeout(waitForOpenCV, 500); }
waitForOpenCV();
