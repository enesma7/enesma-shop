/* E SHOP intro. Lightweight WebGL, synced to assets/intro/intro-audio.m4a
   (the owner-approved first 5.5s of the brand reel).
   0–1s hold, ~1s glitch and shatter, 2–3s drift, 3–4s return, ~4s lock and glow, fade by 5s. */
(function () {
  var KEY = 'enesma_shop_intro_seen';
  var base = window.SHOP_BASE || '/';
  var asset = (window.ENESMA_SHOP && window.ENESMA_SHOP.ASSET) || '20261120q';
  var capture = /[?&]intro=capture(?:&|$)/.test(location.search);
  var reduce = false;
  try { reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) {}

  var LOGO_W = 1.72;
  var LOGO_H = LOGO_W * (352 / 1687.9);
  var CAM = 3.25;
  var LIFT = 0.04;

  var root = document.createElement('div');
  root.className = 'eshop-intro';
  root.setAttribute('role', 'dialog');
  root.setAttribute('aria-modal', 'true');
  root.setAttribute('aria-label', 'E Shop Intro');
  root.innerHTML = '<canvas class="eshop-intro-canvas" aria-hidden="true"></canvas>' +
    '<button type="button" class="eshop-intro-skip">Skip</button>';
  document.body.appendChild(root);

  var canvas = root.querySelector('canvas');
  var skipBtn = root.querySelector('.eshop-intro-skip');
  var app = document.getElementById('app');
  if (app) app.inert = true;

  var audio = null;
  var raf = 0;
  var gl = null;
  var finishing = false;
  var closed = false;
  var started = false;
  var synced = false;
  var overlayGone = false;
  var t0 = 0;
  var manual = -1;
  var sceneDraw = null;
  var onResize = null;

  var api = {
    ready: false,
    cubes: 0,
    seek: function (t) {
      manual = t;
      if (audio) { try { audio.pause(); } catch (err) {} }
      synced = false;
      if (sceneDraw) sceneDraw(t);
      applyFade(t);
    }
  };
  window.__eshopIntro = api;

  function mark() {
    if (capture) return;
    try { sessionStorage.setItem(KEY, '1'); } catch (e) {}
  }
  function onKey(e) {
    if (e.key === 'Escape') { e.preventDefault(); skip(); }
  }
  document.addEventListener('keydown', onKey);
  skipBtn.addEventListener('click', skip);

  function removeOverlay() {
    if (overlayGone) return;
    overlayGone = true;
    document.documentElement.classList.remove('eshop-intro-on');
    if (app) app.inert = false;
    if (root.parentNode) root.parentNode.removeChild(root);
  }
  function closeAll() {
    if (closed) return;
    closed = true;
    finishing = true;
    if (raf) cancelAnimationFrame(raf);
    document.removeEventListener('keydown', onKey);
    if (onResize) window.removeEventListener('resize', onResize);
    if (audio) { try { audio.pause(); } catch (e) {} }
    removeOverlay();
    if (gl) {
      var lose = gl.getExtension('WEBGL_lose_context');
      if (lose) lose.loseContext();
      gl = null;
    }
  }
  function skip() {
    if (finishing) return;
    finishing = true;
    if (audio) { try { audio.pause(); } catch (e) {} }
    if (raf) cancelAnimationFrame(raf);
    root.style.transition = 'opacity .22s linear';
    root.style.opacity = '0';
    setTimeout(closeAll, 240);
  }
  var failTimer = setTimeout(function () { if (!started) closeAll(); }, 2500);

  function hash(n) {
    var x = Math.sin(n * 127.1 + 311.7) * 43758.5453;
    return x - Math.floor(x);
  }

  function recolor(img) {
    var sw = 2048;
    var sh = Math.max(1, Math.round(sw * (img.height / img.width)));
    var c = document.createElement('canvas');
    c.width = sw;
    c.height = sh;
    var ctx = c.getContext('2d', { willReadFrequently: true });
    ctx.clearRect(0, 0, sw, sh);
    ctx.drawImage(img, 0, 0, sw, sh);
    var image = ctx.getImageData(0, 0, sw, sh);
    var d = image.data;
    var span = 1730 - 375.3;
    for (var p = 0, n = d.length; p < n; p += 4) {
      if (d[p + 3] < 14) { d[p + 3] = 0; continue; }
      var r = d[p], g = d[p + 1], b = d[p + 2];
      if (r > g + 12 && r > b + 12 && r > 18) {
        var x = (p / 4) % sw;
        var gt = (x / sw * 1687.9 - 375.3) / span;
        if (gt < 0) gt = 0;
        if (gt > 1) gt = 1;
        d[p] = (239 + (154 - 239) * gt) | 0;
        d[p + 1] = (2 * (1 - gt)) | 0;
        d[p + 2] = 7;
      } else {
        d[p] = 251;
        d[p + 1] = 251;
        d[p + 2] = 251;
      }
    }
    ctx.putImageData(image, 0, 0);
    return c;
  }

  function buildCubes(tex) {
    var sw = tex.width;
    var sh = tex.height;
    var d = tex.getContext('2d', { willReadFrequently: true }).getImageData(0, 0, sw, sh).data;
    var cell = Math.max(8, Math.round(sw / 46));
    var home = [], burst = [], extra = [], kind = [];
    var count = 0;
    var step = Math.max(2, (cell / 3) | 0);
    for (var y = 0; y < sh; y += cell) {
      for (var x = 0; x < sw; x += cell) {
        var cover = 0, reds = 0, samples = 0;
        for (var yy = y; yy < y + cell && yy < sh; yy += step) {
          for (var xx = x; xx < x + cell && xx < sw; xx += step) {
            var p = (yy * sw + xx) * 4;
            samples++;
            if (d[p + 3] < 48) continue;
            cover++;
            if (d[p] > d[p + 1] + 12 && d[p] > 18) reds++;
          }
        }
        if (!samples || cover < samples * 0.3) continue;
        var hx = ((x + cell * 0.5) / sw - 0.5) * LOGO_W;
        var hy = (0.5 - (y + cell * 0.5) / sh) * LOGO_H;
        var h1 = hash(count + 3);
        var h2 = hash(count + 19);
        var h3 = hash(count + 41);
        var along = Math.min(Math.abs(hx) / (LOGO_W * 0.5), 1);
        home.push(hx, hy, 0);
        burst.push(
          hx * (0.06 + h1 * 0.08) + (h2 - 0.5) * 0.05,
          hy * (0.8 + h3 * 0.7) + (h2 - 0.5) * 0.62,
          0.22 + h1 * 0.95 + (1 - along) * 0.85,
          h1
        );
        extra.push(h1 * 2 - 1, h2 * 2 - 1, 0.3 + h3, h2 * 6.283185);
        kind.push(reds > cover * 0.45 ? 1 : 0);
        count++;
      }
    }
    return {
      count: count,
      cube: (cell / sw) * LOGO_W * 0.84,
      home: new Float32Array(home),
      burst: new Float32Array(burst),
      extra: new Float32Array(extra),
      kind: new Float32Array(kind)
    };
  }

  function paintStill(tex) {
    var ctx = canvas.getContext('2d');
    if (!ctx) { closeAll(); return; }
    function size() {
      var dpr = Math.min(window.devicePixelRatio || 1, 2);
      var w = Math.max(1, canvas.clientWidth);
      var h = Math.max(1, canvas.clientHeight);
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      ctx.fillStyle = '#000007';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      var logoPx = Math.min(w * 0.74, 920) * dpr;
      var lh = logoPx * (tex.height / tex.width);
      ctx.drawImage(tex, (canvas.width - logoPx) / 2, (canvas.height - lh) / 2 - canvas.height * 0.02, logoPx, lh);
    }
    onResize = size;
    window.addEventListener('resize', onResize);
    size();
    started = true;
    clearTimeout(failTimer);
    mark();
    api.ready = true;
    var tStart = performance.now();
    function step(now) {
      if (finishing) return;
      var t = (now - tStart) / 1000;
      root.style.opacity = String(t < 0.2 ? 1 : Math.max(0, 1 - (t - 0.2) / 0.7));
      if (t < 0.95) raf = requestAnimationFrame(step);
      else closeAll();
    }
    raf = requestAnimationFrame(step);
  }

  function applyFade(t) {
    if (overlayGone || finishing) return;
    var fade = t < 4.52 ? 1 : Math.max(0, 1 - (t - 4.52) / 0.78);
    root.style.opacity = String(fade);
    if (t >= 4.52) document.documentElement.classList.remove('eshop-intro-on');
    if (t >= 5.32) removeOverlay();
  }

  function clock() {
    if (manual >= 0) return manual;
    if (synced && audio && !audio.paused) return audio.currentTime;
    return (performance.now() - t0) / 1000;
  }

  function frame() {
    if (finishing || !sceneDraw) return;
    var t = clock();
    if (!overlayGone) {
      sceneDraw(t);
      applyFade(t);
    }
    if (synced && audio && !audio.paused) {
      audio.volume = t < 5.05 ? 1 : Math.max(0, 1 - (t - 5.05) / 0.4);
      if (t < 5.5 && !audio.ended) {
        raf = requestAnimationFrame(frame);
        return;
      }
      try { audio.pause(); } catch (e) {}
      return;
    }
    if (t < 5.4) raf = requestAnimationFrame(frame);
  }

  function beginPlayback() {
    mark();
    audio = new Audio(base + 'assets/intro/intro-audio.m4a?v=' + asset + '-shine');
    audio.preload = 'auto';
    audio.playsInline = true;
    var began = false;
    function arm(useAudio) {
      if (finishing) return;
      if (began) {
        if (useAudio && !synced) { try { audio.pause(); } catch (e) {} }
        return;
      }
      began = true;
      synced = !!useAudio;
      t0 = performance.now() - ((useAudio && audio.currentTime) || 0) * 1000;
      raf = requestAnimationFrame(frame);
    }
    sceneDraw(0);
    var pending;
    try { pending = audio.play(); } catch (e) { pending = null; }
    if (pending && pending.then) {
      pending.then(function () { arm(true); }).catch(function () { arm(false); });
    } else arm(false);
    setTimeout(function () { arm(false); }, 500);
  }

  function makeScene(context, ext, texCanvas, cubes) {
    gl = context;
    function compile(type, src) {
      var sh = gl.createShader(type);
      gl.shaderSource(sh, src);
      gl.compileShader(sh);
      if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(sh) || 'shader');
      return sh;
    }
    function link(vs, fs, attribs) {
      var p = gl.createProgram();
      gl.attachShader(p, compile(gl.VERTEX_SHADER, vs));
      gl.attachShader(p, compile(gl.FRAGMENT_SHADER, fs));
      attribs.forEach(function (name, i) { gl.bindAttribLocation(p, i, name); });
      gl.linkProgram(p);
      if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p) || 'link');
      return p;
    }

    var vsCube = [
      'attribute vec3 aPos;',
      'attribute vec3 aNrm;',
      'attribute vec3 aHome;',
      'attribute vec4 aBurst;',
      'attribute vec4 aExtra;',
      'attribute float aKind;',
      'uniform float uTime, uAspect, uFocal, uCam, uCube, uLogoW, uLift;',
      'varying vec3 vCol;',
      'varying vec3 vN;',
      'mat3 spinMat(vec3 a, float ang) {',
      '  a = normalize(a);',
      '  float s = sin(ang);',
      '  float c = cos(ang);',
      '  float ic = 1.0 - c;',
      '  return mat3(',
      '    ic*a.x*a.x+c, ic*a.x*a.y+a.z*s, ic*a.z*a.x-a.y*s,',
      '    ic*a.x*a.y-a.z*s, ic*a.y*a.y+c, ic*a.y*a.z+a.x*s,',
      '    ic*a.z*a.x+a.y*s, ic*a.y*a.z-a.x*s, ic*a.z*a.z+c);',
      '}',
      'void main() {',
      '  float t = uTime;',
      '  float seed = aBurst.w;',
      '  float glitch = 0.0;',
      '  if (t > 0.98 && t < 1.16) glitch = sin((t - 0.98) / 0.18 * 3.14159);',
      '  float bt = clamp((t - (1.04 + seed * 0.18)) / 0.98, 0.0, 1.0);',
      '  float burst = 1.0 - (1.0 - bt) * (1.0 - bt);',
      '  float drift = smoothstep(1.9, 2.25, t) * (1.0 - smoothstep(2.95, 3.25, t));',
      '  float back = smoothstep(3.08, 3.94, t);',
      '  float outAmt = burst * (1.0 - back);',
      '  float ang = outAmt * outAmt * (1.6 + seed * 5.4) + drift * (seed - 0.5) * 2.0;',
      '  mat3 r = spinMat(aExtra.xyz, ang);',
      '  vec3 local = r * (aPos * (uCube * mix(1.0, 1.38, outAmt)));',
      '  vec3 home = aHome;',
      '  float band = step(0.5, fract(seed * 5.0 + aHome.y * 9.0));',
      '  home.x += (band * 2.0 - 1.0) * glitch * 0.075;',
      '  home.y += sin(seed * 42.0) * glitch * 0.02;',
      '  vec3 wob = vec3(',
      '    sin(t * 0.8 + aExtra.w),',
      '    cos(t * 0.66 + aExtra.w),',
      '    sin(t * 0.5 + seed) * 0.45',
      '  ) * drift * 0.12;',
      '  vec3 world = home + aBurst.xyz * outAmt + wob + local;',
      '  float gS = smoothstep(0.99, 1.03, t) * (1.0 - smoothstep(1.06, 1.16, t));',
      '  float bS = smoothstep(3.94, 3.99, t) * (1.0 - smoothstep(4.02, 4.16, t));',
      '  world.x += sin(t * 93.0) * (gS * 0.016 + bS * 0.011);',
      '  world.y += cos(t * 77.0) * (gS * 0.016 + bS * 0.011) + uLift;',
      '  float k = uFocal / max(uCam - world.z, 0.55);',
      '  gl_Position = vec4(world.x * k, world.y * k * uAspect, clamp(0.62 - world.z * 0.28, -0.95, 0.95), 1.0);',
      '  float lx = clamp((aHome.x + aPos.x * uCube) / uLogoW + 0.5, 0.0, 1.0);',
      '  float gt = clamp((lx * 1687.9 - 375.3) / (1730.0 - 375.3), 0.0, 1.0);',
      '  vec3 red = mix(vec3(0.93725, 0.00784, 0.02745), vec3(0.60392, 0.0, 0.02745), gt);',
      '  vCol = mix(vec3(0.98431), red, aKind);',
      '  vN = normalize(r * aNrm);',
      '}'
    ].join('\n');

    var fsCube = [
      'precision mediump float;',
      'varying vec3 vCol;',
      'varying vec3 vN;',
      'void main() {',
      '  vec3 n = normalize(vN);',
      '  float ndl = clamp(dot(n, normalize(vec3(0.28, 0.58, 0.76))), 0.0, 1.0);',
      '  vec3 col = mix(mix(vec3(0.0, 0.0, 0.02745), vCol, 0.34), vCol, 0.12 + 0.88 * ndl);',
      '  gl_FragColor = vec4(col, 1.0);',
      '}'
    ].join('\n');

    var vsBg = 'attribute vec2 aClip; void main() { gl_Position = vec4(aClip, 0.0, 1.0); }';
    var fsBg = [
      'precision mediump float;',
      'uniform float uTime;',
      'uniform vec2 uRes;',
      'void main() {',
      '  float t = uTime;',
      '  vec3 bg = vec3(0.0, 0.0, 0.02745);',
      '  float fw = 1.0 - clamp(abs(t - 1.08) / 0.045, 0.0, 1.0);',
      '  float fr = 1.0 - clamp(abs(t - 1.24) / 0.07, 0.0, 1.0);',
      '  fw *= fw; fr *= fr;',
      '  float gx = gl_FragCoord.x / max(uRes.x, 1.0);',
      '  vec3 red = mix(vec3(0.93725, 0.00784, 0.02745), vec3(0.60392, 0.0, 0.02745), gx);',
      '  bg = mix(bg, vec3(0.98431), fw * 0.72);',
      '  bg = mix(bg, red, fr * 0.55);',
      '  gl_FragColor = vec4(bg, 1.0);',
      '}'
    ].join('\n');

    var vsMark = [
      'attribute vec3 aPos;',
      'attribute vec2 aUv;',
      'uniform float uTime, uAspect, uFocal, uCam, uLogoW, uLift;',
      'varying vec2 vUv;',
      'varying float vA;',
      'void main() {',
      '  float t = uTime;',
      '  float glitch = 0.0;',
      '  if (t > 0.98 && t < 1.16) glitch = sin((t - 0.98) / 0.18 * 3.14159);',
      '  vec3 p = aPos;',
      '  float band = step(0.5, fract(aUv.y * 12.0 + glitch * 7.0));',
      '  p.x += (band * 2.0 - 1.0) * glitch * uLogoW * 0.038;',
      '  float gS = smoothstep(0.99, 1.03, t) * (1.0 - smoothstep(1.06, 1.16, t));',
      '  p.x += sin(t * 93.0) * gS * 0.016;',
      '  p.y += cos(t * 77.0) * gS * 0.016 + uLift;',
      '  float k = uFocal / uCam;',
      '  gl_Position = vec4(p.x * k, p.y * k * uAspect, 0.2, 1.0);',
      '  vUv = aUv;',
      '  float a = 1.0;',
      '  if (t >= 1.02 && t < 1.14) a = 1.0 - (t - 1.02) / 0.12;',
      '  else if (t >= 1.14 && t < 3.7) a = 0.0;',
      '  else if (t >= 3.7 && t < 3.98) a = (t - 3.7) / 0.28;',
      '  vA = a;',
      '}'
    ].join('\n');

    var fsLogo = [
      'precision highp float;',
      'varying vec2 vUv;',
      'varying float vA;',
      'uniform sampler2D uTex;',
      'uniform float uTime;',
      'void main() {',
      '  vec4 tex = texture2D(uTex, vUv);',
      '  if (tex.a * vA < 0.02) discard;',
      '  float t = uTime;',
      '  float u = clamp((t - 3.98) / 0.6, 0.0, 1.0);',
      '  float diag = vUv.x * 0.9 + vUv.y * 0.22;',
      '  float head = u * 1.45 - 0.22;',
      '  float d = diag - head;',
      '  float band = exp(-d * d * 42.0);',
      '  float env = smoothstep(0.0, 0.05, u) * (1.0 - smoothstep(0.8, 1.0, u));',
      '  float sweep = band * env;',
      '  vec3 col = mix(tex.rgb, vec3(0.98431), clamp(sweep, 0.0, 0.7));',
      '  gl_FragColor = vec4(col, tex.a * vA);',
      '}'
    ].join('\n');

    var cubeProg = link(vsCube, fsCube, ['aPos', 'aNrm', 'aHome', 'aBurst', 'aExtra', 'aKind']);
    var bgProg = link(vsBg, fsBg, ['aClip']);
    var logoProg = link(vsMark, fsLogo, ['aPos', 'aUv']);

    function buffer(data) {
      var b = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, b);
      gl.bufferData(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW);
      return b;
    }

    var s = 0.5;
    var faces = [
      [[-s, -s, s], [s, -s, s], [s, s, s], [-s, s, s], [0, 0, 1]],
      [[s, -s, -s], [-s, -s, -s], [-s, s, -s], [s, s, -s], [0, 0, -1]],
      [[s, -s, s], [s, -s, -s], [s, s, -s], [s, s, s], [1, 0, 0]],
      [[-s, -s, -s], [-s, -s, s], [-s, s, s], [-s, s, -s], [-1, 0, 0]],
      [[-s, s, s], [s, s, s], [s, s, -s], [-s, s, -s], [0, 1, 0]],
      [[-s, -s, -s], [s, -s, -s], [s, -s, s], [-s, -s, s], [0, -1, 0]]
    ];
    var unitPos = [];
    var unitNrm = [];
    faces.forEach(function (f) {
      var n = f[4];
      [0, 1, 2, 0, 2, 3].forEach(function (idx) {
        unitPos.push(f[idx][0], f[idx][1], f[idx][2]);
        unitNrm.push(n[0], n[1], n[2]);
      });
    });
    var unitVerts = unitPos.length / 3;
    var posA = [], nrmA = [], homeA = [], burstA = [], extraA = [], kindA = [];
    for (var ci = 0; ci < cubes.count; ci++) {
      for (var v = 0; v < unitVerts; v++) {
        posA.push(unitPos[v * 3], unitPos[v * 3 + 1], unitPos[v * 3 + 2]);
        nrmA.push(unitNrm[v * 3], unitNrm[v * 3 + 1], unitNrm[v * 3 + 2]);
        homeA.push(cubes.home[ci * 3], cubes.home[ci * 3 + 1], cubes.home[ci * 3 + 2]);
        burstA.push(cubes.burst[ci * 4], cubes.burst[ci * 4 + 1], cubes.burst[ci * 4 + 2], cubes.burst[ci * 4 + 3]);
        extraA.push(cubes.extra[ci * 4], cubes.extra[ci * 4 + 1], cubes.extra[ci * 4 + 2], cubes.extra[ci * 4 + 3]);
        kindA.push(cubes.kind[ci]);
      }
    }
    var cubeVerts = posA.length / 3;
    var bPos = buffer(new Float32Array(posA));
    var bNrm = buffer(new Float32Array(nrmA));
    var bHome = buffer(new Float32Array(homeA));
    var bBurst = buffer(new Float32Array(burstA));
    var bExtra = buffer(new Float32Array(extraA));
    var bKind = buffer(new Float32Array(kindA));
    var hw = LOGO_W / 2;
    var hh = LOGO_H / 2;
    var bLogo = buffer(new Float32Array([
      -hw, -hh, 0, 0, 0,
      hw, -hh, 0, 1, 0,
      -hw, hh, 0, 0, 1,
      hw, hh, 0, 1, 1
    ]));
    var bBg = buffer(new Float32Array([-1, -1, 3, -1, -1, 3]));

    var tex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, 1);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, texCanvas);

    function resetAttribs() {
      for (var i = 0; i < 6; i++) gl.disableVertexAttribArray(i);
    }
    function attrib(index, buf, size, stride, offset) {
      gl.bindBuffer(gl.ARRAY_BUFFER, buf);
      gl.enableVertexAttribArray(index);
      gl.vertexAttribPointer(index, size, gl.FLOAT, false, stride, offset);
    }

    gl.enable(gl.CULL_FACE);

    function drawAt(t) {
      var dpr = Math.min(window.devicePixelRatio || 1, 2);
      var w = Math.max(1, canvas.clientWidth);
      var h = Math.max(1, canvas.clientHeight);
      var pw = Math.round(w * dpr);
      var ph = Math.round(h * dpr);
      if (canvas.width !== pw || canvas.height !== ph) {
        canvas.width = pw;
        canvas.height = ph;
      }
      gl.viewport(0, 0, canvas.width, canvas.height);
      var aspect = w / h;
      var logoPx = Math.min(w * 0.74, 920);
      var focal = CAM * logoPx * 2 / (LOGO_W * w);

      gl.disable(gl.BLEND);
      gl.depthMask(true);
      gl.disable(gl.DEPTH_TEST);
      gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
      gl.depthMask(false);
      resetAttribs();

      gl.useProgram(bgProg);
      attrib(0, bBg, 2, 0, 0);
      gl.uniform1f(gl.getUniformLocation(bgProg, 'uTime'), t);
      gl.uniform2f(gl.getUniformLocation(bgProg, 'uRes'), canvas.width, canvas.height);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
      gl.clear(gl.DEPTH_BUFFER_BIT);
      gl.enable(gl.DEPTH_TEST);
      gl.depthMask(true);

      if (t >= 0.97 && t <= 3.98) {
        gl.enable(gl.DEPTH_TEST);
        gl.enable(gl.CULL_FACE);
        gl.useProgram(cubeProg);
        attrib(0, bPos, 3, 0, 0);
        attrib(1, bNrm, 3, 0, 0);
        attrib(2, bHome, 3, 0, 0);
        attrib(3, bBurst, 4, 0, 0);
        attrib(4, bExtra, 4, 0, 0);
        attrib(5, bKind, 1, 0, 0);
        gl.uniform1f(gl.getUniformLocation(cubeProg, 'uTime'), t);
        gl.uniform1f(gl.getUniformLocation(cubeProg, 'uAspect'), aspect);
        gl.uniform1f(gl.getUniformLocation(cubeProg, 'uFocal'), focal);
        gl.uniform1f(gl.getUniformLocation(cubeProg, 'uCam'), CAM);
        gl.uniform1f(gl.getUniformLocation(cubeProg, 'uCube'), cubes.cube);
        gl.uniform1f(gl.getUniformLocation(cubeProg, 'uLogoW'), LOGO_W);
        gl.uniform1f(gl.getUniformLocation(cubeProg, 'uLift'), LIFT);
        gl.drawArrays(gl.TRIANGLES, 0, cubeVerts);
      }

      resetAttribs();
      gl.enable(gl.BLEND);
      gl.disable(gl.CULL_FACE);
      gl.depthMask(false);
      gl.disable(gl.DEPTH_TEST);

      function mark(prog) {
        gl.useProgram(prog);
        attrib(0, bLogo, 3, 20, 0);
        attrib(1, bLogo, 2, 20, 12);
        gl.uniform1f(gl.getUniformLocation(prog, 'uTime'), t);
        gl.uniform1f(gl.getUniformLocation(prog, 'uAspect'), aspect);
        gl.uniform1f(gl.getUniformLocation(prog, 'uFocal'), focal);
        gl.uniform1f(gl.getUniformLocation(prog, 'uCam'), CAM);
        gl.uniform1f(gl.getUniformLocation(prog, 'uLogoW'), LOGO_W);
        gl.uniform1f(gl.getUniformLocation(prog, 'uLift'), LIFT);
        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, tex);
        gl.uniform1i(gl.getUniformLocation(prog, 'uTex'), 0);
      }

      gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
      mark(logoProg);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
      gl.depthMask(true);
    }

    onResize = function () {
      if (!finishing && manual < 0 && sceneDraw) sceneDraw(clock());
    };
    window.addEventListener('resize', onResize);
    return drawAt;
  }

  var img = new Image();
  img.onload = function () {
    try {
      var tex = recolor(img);
      var cubes = buildCubes(tex);
      api.cubes = cubes.count;
      if (reduce || cubes.count < 8) {
        paintStill(tex);
        return;
      }
      var context = canvas.getContext('webgl', {
        alpha: false,
        antialias: true,
        depth: true,
        stencil: false,
        powerPreference: 'high-performance',
        preserveDrawingBuffer: !!capture
      });
      if (!context) {
        paintStill(tex);
        return;
      }
      sceneDraw = makeScene(context, null, tex, cubes);
      started = true;
      clearTimeout(failTimer);
      api.ready = true;
      if (capture) sceneDraw(0);
      else beginPlayback();
    } catch (err) {
      api.error = String(err && err.message || err);
      closeAll();
    }
  };
  img.onerror = function () { closeAll(); };
  img.src = base + 'assets/logo/eshop-lockup.svg';
})();
