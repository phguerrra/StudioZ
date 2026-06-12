import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";

(function () {
  "use strict";

  var BASE_PRICES = {
    caneca: 45,
    copo_termico: 89,
    garrafa: 120,
    copo_pers: 35,
  };

  var DEFAULT_SIZES = {
    caneca: { diameter: 8, height: 10 },
    copo_termico: { diameter: 9, height: 18 },
    garrafa: { diameter: 7, height: 24 },
    copo_pers: { diameter: 7, height: 6 },
  };

  async function loadBasePrices() {
    try {
      var res = await fetch("/api/prices", { cache: "no-store" });
      var data = await res.json();
      if (!res.ok || !data.ok || !Array.isArray(data.prices)) return;
      data.prices.forEach(function (p) {
        var value = Number(p && p.basePrice);
        if (p && p.productKey && Number.isFinite(value)) {
          BASE_PRICES[p.productKey] = value;
        }
      });
      updatePriceDisplay();
    } catch (e) {
      // mantém defaults
    }
  }

  var uploadedImage = null;
  var editState = {
    imageX: 0.5,
    imageY: 0.38,
    imageScale: 1,
    textX: 0.5,
    textY: 0.74,
    textScale: 1,
    productRotation: 0,
    productZoom: 1,
    active: "image",
    dragging: null,
    dragStartX: 0,
    dragStartRotation: 0,
    controlsWired: false
  };

  var THREE_TEXTURE_W = 1024;
  var THREE_TEXTURE_H = 512;

  var threePreview = {
    initialized: false,
    renderer: null,
    scene: null,
    camera: null,
    controls: null,
    productGroup: null,
    printMesh: null,
    bodyMaterial: null,
    printMaterial: null,
    trimMaterial: null,
    shadowPlane: null,
    textureCanvas: null,
    textureCtx: null,
    texture: null,
    animId: null,
    lastGeometryKey: "",
    webglFailed: false
  };

  function getCurrentFormState() {
    var productEl = document.getElementById("productSelect");
    var colorEl = document.getElementById("productColor");
    var textEl = document.getElementById("customText");
    var fontEl = document.getElementById("fontSelect");
    var positionEl = document.getElementById("positionSelect");
    var productKey = productEl ? productEl.value : "caneca";
    var size = DEFAULT_SIZES[productKey] || DEFAULT_SIZES.caneca;

    return {
      productKey: productKey,
      diameterCm: size.diameter,
      heightCm: size.height,
      color: colorEl && colorEl.value ? colorEl.value : "#cbd5e1",
      text: textEl && textEl.value ? textEl.value : "",
      fontFamily: fontEl && fontEl.value ? fontEl.value : "Outfit",
      position: positionEl && positionEl.value ? positionEl.value : "center",
      image: uploadedImage
    };
  }

  function getShapeMultipliers(productKey) {
    // Multiplicadores para criar "silhuetas" diferentes.
    var m = {
      radiusMul: 1,
      heightMul: 1
    };
    if (productKey === "caneca") {
      m.radiusMul = 1.12;
      m.heightMul = 0.82;
    } else if (productKey === "copo_termico") {
      m.radiusMul = 0.98;
      m.heightMul = 1.28;
    } else if (productKey === "garrafa") {
      m.radiusMul = 0.72;
      m.heightMul = 1.35;
    } else if (productKey === "copo_pers") {
      m.radiusMul = 1.02;
      m.heightMul = 0.56;
    }
    return m;
  }

  function hexToNumber(hex) {
    if (!hex) return 0xffffff;
    var s = String(hex).trim();
    if (s[0] === "#") s = s.slice(1);
    // aceita #rgb ou #rrggbb
    if (s.length === 3) s = s[0] + s[0] + s[1] + s[1] + s[2] + s[2];
    var n = parseInt(s, 16);
    return isNaN(n) ? 0xffffff : n;
  }

  function ensureTextureCanvas() {
    if (threePreview.textureCanvas && threePreview.textureCtx) return;
    threePreview.textureCanvas = document.createElement("canvas");
    threePreview.textureCanvas.width = THREE_TEXTURE_W;
    threePreview.textureCanvas.height = THREE_TEXTURE_H;
    threePreview.textureCtx = threePreview.textureCanvas.getContext("2d");
  }

  var PREVIEW_FALLBACK_W = 320;
  var PREVIEW_FALLBACK_H = 360;

  function readPreviewCssSize(canvas) {
    var rect = canvas.getBoundingClientRect();
    var rw = Math.round(rect.width);
    var rh = Math.round(rect.height);
    var cw = canvas.clientWidth;
    var ch = canvas.clientHeight;
    var attrW = parseInt(canvas.getAttribute("width"), 10) || PREVIEW_FALLBACK_W;
    var attrH = parseInt(canvas.getAttribute("height"), 10) || PREVIEW_FALLBACK_H;

    // Preferir tamanho já pintado no layout; senão client*; senão atributos HTML.
    var w = rw > 0 ? rw : cw > 0 ? cw : attrW;
    var h = rh > 0 ? rh : ch > 0 ? ch : attrH;

    // Se só uma dimensão veio (comum com height:auto antes do reflow), deriva pela proporção do atributo.
    if (w > 0 && h <= 0) h = Math.round((w * attrH) / attrW);
    if (h > 0 && w <= 0) w = Math.round((h * attrW) / attrH);

    w = Math.max(1, Math.round(w));
    h = Math.max(1, Math.round(h));
    return { w: w, h: h };
  }

  function resizeThreePreview() {
    var canvas = document.getElementById("previewCanvas");
    if (!canvas || !threePreview.renderer || !threePreview.camera) return;

    var size = readPreviewCssSize(canvas);
    var w = size.w;
    var h = size.h;

    // Tamanhos w/h são em pixels CSS; setSize aplica devicePixelRatio no buffer WebGL.
    var dpr = Math.min(typeof window !== "undefined" && window.devicePixelRatio ? window.devicePixelRatio : 1, 2);
    threePreview.renderer.setPixelRatio(dpr);
    threePreview.renderer.setSize(w, h, false);
    threePreview.camera.aspect = w / h;
    threePreview.camera.updateProjectionMatrix();
  }

  function initThreePreview() {
    console.log("🟡 initThreePreview chamado");
    if (threePreview.initialized) {
      console.log("⚠️ já inicializado, pulando");
      return;
    }

    var canvas = document.getElementById("previewCanvas");
    console.log("🎨 canvas encontrado:", canvas);
    if (!canvas) {
      console.warn("❌ previewCanvas ausente no DOM");
      return;
    }

    console.log("📐 canvas size (buffer):", canvas.width, canvas.height);
    console.log("📐 canvas rect:", canvas.getBoundingClientRect());

    ensureTextureCanvas();

    threePreview.scene = new THREE.Scene();
    try {
      threePreview.renderer = new THREE.WebGLRenderer({
        canvas: canvas,
        antialias: true,
        alpha: true,
        preserveDrawingBuffer: false
      });
    } catch (err) {
      threePreview.webglFailed = true;
      threePreview.initialized = true;
      console.warn("WebGL indisponível; usando prévia 2D realista.", err);
      return;
    }
    threePreview.renderer.setClearColor(0xf8fafc, 1);
    threePreview.renderer.shadowMap.enabled = true;
    threePreview.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    if (THREE.SRGBColorSpace) threePreview.renderer.outputColorSpace = THREE.SRGBColorSpace;
    threePreview.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    threePreview.renderer.toneMappingExposure = 1.05;

    threePreview.camera = new THREE.PerspectiveCamera(45, 1, 0.1, 200);
    threePreview.camera.position.set(0, 2, 6);

    var hemi = new THREE.HemisphereLight(0xffffff, 0xb6c2d1, 1.25);
    threePreview.scene.add(hemi);

    var key = new THREE.DirectionalLight(0xffffff, 1.75);
    key.position.set(3.5, 6.5, 4.5);
    key.castShadow = true;
    key.shadow.mapSize.set(1024, 1024);
    key.shadow.camera.near = 0.5;
    key.shadow.camera.far = 20;
    key.shadow.camera.left = -5;
    key.shadow.camera.right = 5;
    key.shadow.camera.top = 5;
    key.shadow.camera.bottom = -5;
    threePreview.scene.add(key);

    var rim = new THREE.DirectionalLight(0xffffff, 0.85);
    rim.position.set(-4, 3, -3);
    threePreview.scene.add(rim);

    threePreview.bodyMaterial = new THREE.MeshPhysicalMaterial({
      color: hexToNumber(getProductColor()),
      roughness: 0.34,
      metalness: 0.18,
      clearcoat: 0.55,
      clearcoatRoughness: 0.25
    });

    threePreview.printMaterial = new THREE.MeshPhysicalMaterial({
      color: 0xffffff,
      roughness: 0.48,
      metalness: 0,
      clearcoat: 0.35,
      clearcoatRoughness: 0.32,
      transparent: true,
      side: THREE.FrontSide,
      polygonOffset: true,
      polygonOffsetFactor: -2,
      polygonOffsetUnits: -2
    });

    threePreview.trimMaterial = new THREE.MeshPhysicalMaterial({
      color: 0xf8fafc,
      roughness: 0.22,
      metalness: 0.32,
      clearcoat: 0.6,
      clearcoatRoughness: 0.18
    });

    var plane = new THREE.Mesh(
      new THREE.CircleGeometry(3.4, 96),
      new THREE.ShadowMaterial({ color: 0x0f172a, opacity: 0.18 })
    );
    plane.rotation.x = -Math.PI / 2;
    plane.position.y = -1.25;
    plane.receiveShadow = true;
    threePreview.shadowPlane = plane;
    threePreview.scene.add(plane);

    threePreview.controls = new OrbitControls(threePreview.camera, threePreview.renderer.domElement);
    threePreview.controls.enableDamping = true;
    threePreview.controls.dampingFactor = 0.08;
    threePreview.controls.enablePan = false;
    threePreview.controls.enableZoom = true;
    threePreview.controls.minDistance = 2;
    threePreview.controls.maxDistance = 20;
    syncPreviewControls();

    resizeThreePreview();
    // Primeiro frame pode ter rect 0; segundo layout estabiliza (grid/sticky).
    requestAnimationFrame(function () {
      resizeThreePreview();
    });
    if (typeof ResizeObserver !== "undefined") {
      var ro = new ResizeObserver(function () {
        resizeThreePreview();
      });
      ro.observe(canvas);
    }

    function animate() {
      threePreview.animId = requestAnimationFrame(animate);
      if (threePreview.controls) threePreview.controls.update();
      if (threePreview.renderer && threePreview.scene && threePreview.camera) {
        threePreview.renderer.render(threePreview.scene, threePreview.camera);
      }
    }
    animate();

    window.addEventListener("resize", function () {
      resizeThreePreview();
    });

    threePreview.initialized = true;
    console.log("✅ initThreePreview concluído (threePreview.initialized = true)");
  }

  function drawCanvasFallbackPreview(state) {
    var canvas = document.getElementById("previewCanvas");
    if (!canvas) return;
    var size = readPreviewCssSize(canvas);
    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(size.w * dpr);
    canvas.height = Math.round(size.h * dpr);
    var ctx = canvas.getContext("2d");
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, size.w, size.h);

    var cx = size.w / 2;
    var top = size.h * 0.12;
    var h = size.h * 0.68;
    var w = size.w * (state.productKey === "garrafa" ? 0.34 : 0.48);
    var bottom = top + h;
    var topW = state.productKey === "copo_termico" ? w * 1.08 : state.productKey === "copo_pers" ? w * 1.12 : w;
    var bottomW = state.productKey === "garrafa" ? w * 0.98 : w * 0.82;

    if (state.productKey === "garrafa") {
      topW = w * 0.55;
      h = size.h * 0.76;
      top = size.h * 0.06;
      bottom = top + h;
    } else if (state.productKey === "copo_termico") {
      w = size.w * 0.42;
      topW = w * 1.12;
      bottomW = w * 0.72;
      h = size.h * 0.74;
      top = size.h * 0.08;
      bottom = top + h;
    } else if (state.productKey === "copo_pers") {
      w = size.w * 0.52;
      topW = w * 1.12;
      bottomW = w * 0.72;
      h = size.h * 0.45;
      top = size.h * 0.2;
      bottom = top + h;
    } else if (state.productKey === "caneca") {
      w = size.w * 0.48;
      topW = w * 1.04;
      bottomW = w * 0.94;
      h = size.h * 0.58;
      top = size.h * 0.16;
      bottom = top + h;
    }

    var bodyGrad = ctx.createLinearGradient(cx - w, 0, cx + w, 0);
    bodyGrad.addColorStop(0, shadeHex(state.color, -38));
    bodyGrad.addColorStop(0.18, shadeHex(state.color, 34));
    bodyGrad.addColorStop(0.48, state.color);
    bodyGrad.addColorStop(0.78, shadeHex(state.color, 18));
    bodyGrad.addColorStop(1, shadeHex(state.color, -42));

    ctx.save();
    ctx.shadowColor = "rgba(15,23,42,0.22)";
    ctx.shadowBlur = 24;
    ctx.shadowOffsetY = 14;
    ctx.fillStyle = bodyGrad;
    roundedProductPath(ctx, cx, top, topW, bottomW, h, state.productKey);
    ctx.fill();
    ctx.restore();

    ctx.strokeStyle = "rgba(255,255,255,0.72)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.ellipse(cx, top + 4, topW / 2, 10, 0, 0, Math.PI * 2);
    ctx.stroke();

    if (state.productKey === "copo_termico") {
      ctx.fillStyle = "rgba(248,250,252,0.92)";
      ctx.beginPath();
      ctx.ellipse(cx, top - 2, topW * 0.54, 12, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = "rgba(226,232,240,0.95)";
      roundedRectPath(ctx, cx - topW * 0.22, top - 18, topW * 0.44, 18, 8);
      ctx.fill();
      ctx.strokeStyle = "rgba(148,163,184,0.8)";
      ctx.lineWidth = 5;
      ctx.beginPath();
      ctx.moveTo(cx + topW * 0.18, top - 18);
      ctx.lineTo(cx + topW * 0.28, top - 78);
      ctx.stroke();
    }

    if (state.productKey === "caneca") {
      var handleX = cx + w * 0.56;
      var handleY = top + h * 0.45;
      var handleOuterW = w * 0.46;
      var handleOuterH = h * 0.36;
      ctx.save();
      ctx.shadowColor = "rgba(15,23,42,0.2)";
      ctx.shadowBlur = 12;
      ctx.shadowOffsetY = 6;
      ctx.strokeStyle = bodyGrad;
      ctx.lineWidth = Math.max(12, w * 0.15);
      ctx.lineCap = "round";
      ctx.beginPath();
      ctx.ellipse(handleX, handleY, handleOuterW, handleOuterH, 0, -Math.PI / 2, Math.PI / 2);
      ctx.stroke();
      ctx.restore();

      ctx.strokeStyle = "rgba(255,255,255,0.34)";
      ctx.lineWidth = Math.max(2, w * 0.025);
      ctx.lineCap = "round";
      ctx.beginPath();
      ctx.ellipse(handleX - w * 0.02, handleY - h * 0.015, handleOuterW * 0.78, handleOuterH * 0.82, 0, -Math.PI / 2, Math.PI / 2);
      ctx.stroke();
    }

    var printW = Math.min(topW * 1.08, size.w * 0.7);
    var printH = h * 0.82;
    var printX = cx - printW / 2;
    var printY = top + h * 0.1;
    ctx.save();
    roundedProductPath(ctx, cx, top, topW, bottomW, h, state.productKey);
    ctx.clip();
    if (state.image && state.image.complete) {
      var imgW = printW * 0.72 * editState.imageScale;
      var imgH = printH * 0.55 * editState.imageScale;
      drawImageCover(
        ctx,
        state.image,
        printX + printW * editState.imageX - imgW / 2,
        printY + printH * editState.imageY - imgH / 2,
        imgW,
        imgH
      );
    } else {
      ctx.fillStyle = "rgba(100,116,139,0.18)";
      ctx.fillRect(
        printX + printW * editState.imageX - printW * 0.28 * editState.imageScale,
        printY + printH * editState.imageY - printH * 0.16 * editState.imageScale,
        printW * 0.56 * editState.imageScale,
        printH * 0.32 * editState.imageScale
      );
    }
    if (state.image && state.image.complete) {
      ctx.fillStyle = "rgba(255,255,255,0.24)";
      ctx.fillRect(printX, printY, printW * 0.22, printH);
    }
    drawFallbackText(ctx, state, printX, printY, printW, printH);
    ctx.restore();

    if (state.productKey === "copo_pers") {
      ctx.fillStyle = "rgba(226,232,240,0.95)";
      ctx.beginPath();
      ctx.ellipse(cx, bottom + 10, bottomW * 0.52, 8, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillRect(cx - bottomW * 0.2, bottom, bottomW * 0.4, 18);
      ctx.beginPath();
      ctx.ellipse(cx, bottom + 24, bottomW * 0.78, 7, 0, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.fillStyle = "rgba(15,23,42,0.16)";
    ctx.beginPath();
    ctx.ellipse(cx, bottom + 18, w * 0.72, 13, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  function roundedProductPath(ctx, cx, top, topW, bottomW, h, productKey) {
    var bottom = top + h;
    ctx.beginPath();
    if (productKey === "garrafa") {
      var shoulderY = top + h * 0.26;
      ctx.moveTo(cx - topW / 2, top);
      ctx.lineTo(cx + topW / 2, top);
      ctx.bezierCurveTo(cx + topW * 0.6, shoulderY, cx + bottomW / 2, shoulderY, cx + bottomW / 2, shoulderY + 8);
      ctx.lineTo(cx + bottomW / 2, bottom);
      ctx.quadraticCurveTo(cx, bottom + 18, cx - bottomW / 2, bottom);
      ctx.lineTo(cx - bottomW / 2, shoulderY + 8);
      ctx.bezierCurveTo(cx - bottomW / 2, shoulderY, cx - topW * 0.6, shoulderY, cx - topW / 2, top);
    } else {
      ctx.moveTo(cx - topW / 2, top);
      ctx.quadraticCurveTo(cx, top - 14, cx + topW / 2, top);
      ctx.lineTo(cx + bottomW / 2, bottom);
      ctx.quadraticCurveTo(cx, bottom + 14, cx - bottomW / 2, bottom);
      ctx.closePath();
    }
  }

  function roundedRectPath(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, r);
  }

  function drawImageCover(ctx, img, x, y, w, h) {
    var scale = Math.max(w / img.width, h / img.height);
    var dw = img.width * scale;
    var dh = img.height * scale;
    ctx.drawImage(img, x + (w - dw) / 2, y + (h - dh) / 2, dw, dh);
  }

  function drawFallbackText(ctx, state, x, y, w, h) {
    var text = (state.text || "").trim();
    if (!text) return;
    ctx.fillStyle = "#1e293b";
    ctx.font = "700 " + Math.max(12, Math.round(h * 0.16 * editState.textScale)) + "px '" + state.fontFamily + "', sans-serif";
    ctx.textAlign = "center";
    wrapText(ctx, text, x + w * editState.textX, y + h * editState.textY, w * 0.82, Math.round(h * 0.18));
  }

  function shadeHex(hex, amount) {
    var n = hexToNumber(hex);
    var r = Math.max(0, Math.min(255, (n >> 16) + amount));
    var g = Math.max(0, Math.min(255, ((n >> 8) & 255) + amount));
    var b = Math.max(0, Math.min(255, (n & 255) + amount));
    return "rgb(" + r + "," + g + "," + b + ")";
  }

  function drawCoverImageToTexture(ctx, img, W, H, centerX, centerY) {
    var iw = img.width;
    var ih = img.height;
    if (!iw || !ih) return;

    var boxW = W * 0.72 * editState.imageScale;
    var boxH = H * 0.42 * editState.imageScale;
    var scale = Math.max(boxW / iw, boxH / ih);
    var dw = iw * scale;
    var dh = ih * scale;
    var dx = W * centerX - dw / 2;
    var dy = H * centerY - dh / 2;

    ctx.drawImage(img, dx, dy, dw, dh);
  }

  function drawPlaceholderImageToTexture(ctx, W, H) {
    ctx.fillStyle = "rgba(255,255,255,0.35)";
    ctx.fillRect(W * (editState.imageX - 0.34), H * (editState.imageY - 0.14), W * 0.68, H * 0.28);

    ctx.fillStyle = "#64748b";
    ctx.font = "13px Outfit, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("Envie uma imagem", W * editState.imageX, H * editState.imageY - 6);
    ctx.fillText("para ver aqui", W * editState.imageX, H * editState.imageY + 12);
  }

  function updateTextureFromForm(state) {
    ensureTextureCanvas();
    var ctx = threePreview.textureCtx;
    var W = THREE_TEXTURE_W;
    var H = THREE_TEXTURE_H;

    ctx.clearRect(0, 0, W, H);

    var grad = ctx.createLinearGradient(0, 0, W, 0);
    grad.addColorStop(0, "rgba(15,23,42,0.10)");
    grad.addColorStop(0.18, "rgba(255,255,255,0.72)");
    grad.addColorStop(0.5, "rgba(255,255,255,0)");
    grad.addColorStop(0.86, "rgba(15,23,42,0.08)");
    grad.addColorStop(1, "rgba(15,23,42,0.16)");

    if (state.image && state.image.complete) {
      ctx.save();
      drawCoverImageToTexture(ctx, state.image, W, H, editState.imageX, editState.imageY);
      ctx.restore();
    } else {
      drawPlaceholderImageToTexture(ctx, W, H);
    }

    if (state.image && state.image.complete) {
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, W, H);
    }

    // Texto sobreposto (Canvas 2D -> textura no cilindro 3D).
    var text = (state.text || "").trim();
    if (text) {
      var fontSize = Math.round(H * 0.09 * editState.textScale); // ~46px no padrão
      var lineHeight = Math.round(fontSize * 1.05);
      var maxW = W * 0.78;

      ctx.font = "600 " + fontSize + "px '" + state.fontFamily + "', sans-serif";
      ctx.fillStyle = "#1e293b";

      ctx.textAlign = "center";
      var x = W * editState.textX;
      var y = H * editState.textY;
      wrapText(ctx, text, x, y, maxW, lineHeight);
    }

    if (!threePreview.texture) {
      threePreview.texture = new THREE.CanvasTexture(threePreview.textureCanvas);
      // Compatibilidade com versões diferentes do Three.
      if (THREE.SRGBColorSpace) threePreview.texture.colorSpace = THREE.SRGBColorSpace;
      threePreview.texture.flipY = true;
      // wrapS precisa "repetir" ao redor do cilindro.
      threePreview.texture.wrapS = THREE.RepeatWrapping;
      threePreview.texture.wrapT = THREE.ClampToEdgeWrapping;
      threePreview.texture.repeat.set(1, 1);
      threePreview.texture.needsUpdate = true;
    } else {
      threePreview.texture.needsUpdate = true;
    }

    if (threePreview.printMaterial) {
      threePreview.printMaterial.map = threePreview.texture;
      threePreview.printMaterial.needsUpdate = true;
    }
    if (threePreview.bodyMaterial) {
      threePreview.bodyMaterial.color.set(hexToNumber(state.color));
      threePreview.bodyMaterial.needsUpdate = true;
    }
  }

  function updateGeometryFromForm(state) {
    if (!threePreview.scene) return;

    var multipliers = getShapeMultipliers(state.productKey);
    var cmToWorld = 0.2;

    var radiusCm = state.diameterCm / 2;
    var radiusWorld = Math.max(0.08, radiusCm * multipliers.radiusMul * cmToWorld);
    var heightWorld = Math.max(0.08, state.heightCm * multipliers.heightMul * cmToWorld);

    // Chave para evitar recriar geometria em updates pequenos.
    var geometryKey = [state.productKey, radiusWorld.toFixed(3), heightWorld.toFixed(3)].join("|");
    if (threePreview.lastGeometryKey !== geometryKey) {
      threePreview.lastGeometryKey = geometryKey;
      rebuildProductModel(state.productKey, radiusWorld, heightWorld);
    }

    // Ajusta câmera para caber no cilindro.
    var cameraDist = Math.max(radiusWorld * 4.6 + 2.15, heightWorld * 1.05 + 2.1);
    threePreview.camera.position.set(0, heightWorld * 0.2, cameraDist / editState.productZoom);
    if (threePreview.controls && threePreview.controls.target) {
      threePreview.controls.target.set(0, 0, 0);
    }
    if (threePreview.shadowPlane) threePreview.shadowPlane.position.y = -heightWorld / 2 - 0.035;

    // Visual inicial coerente com a posição escolhida.
    var rot = 0;
    if (state.position === "left") rot = Math.PI / 6;
    if (state.position === "right") rot = -Math.PI / 6;
    rot += editState.productRotation;
    if (threePreview.productGroup) threePreview.productGroup.rotation.y = rot;
  }

  function disposeObject(obj) {
    obj.traverse(function (child) {
      if (child.geometry) child.geometry.dispose();
    });
  }

  function addMesh(group, geometry, material, position, rotation, scale) {
    var mesh = new THREE.Mesh(geometry, material);
    if (position) mesh.position.set(position.x || 0, position.y || 0, position.z || 0);
    if (rotation) mesh.rotation.set(rotation.x || 0, rotation.y || 0, rotation.z || 0);
    if (scale) mesh.scale.set(scale.x || 1, scale.y || 1, scale.z || 1);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    group.add(mesh);
    return mesh;
  }

  function rebuildProductModel(productKey, radius, height) {
    if (threePreview.productGroup) {
      disposeObject(threePreview.productGroup);
      threePreview.scene.remove(threePreview.productGroup);
    }

    var group = new THREE.Group();
    var body = threePreview.bodyMaterial;
    var trim = threePreview.trimMaterial;
    var print = threePreview.printMaterial;
    var topY = height / 2;
    var bottomY = -height / 2;
    var printHeight = height * 0.82;
    var printY = productKey === "garrafa" ? -height * 0.08 : -height * 0.02;

    if (productKey === "garrafa") {
      var shoulderH = height * 0.16;
      var neckH = height * 0.23;
      var bodyH = height - shoulderH - neckH;
      addMesh(group, new THREE.CylinderGeometry(radius, radius * 0.95, bodyH, 128, 8, false), body, { y: bottomY + bodyH / 2 });
      addMesh(group, new THREE.CylinderGeometry(radius * 0.48, radius * 0.95, shoulderH, 128, 4, false), body, { y: bottomY + bodyH + shoulderH / 2 });
      addMesh(group, new THREE.CylinderGeometry(radius * 0.42, radius * 0.42, neckH, 96, 3, false), body, { y: topY - neckH / 2 });
      addMesh(group, new THREE.CylinderGeometry(radius * 0.48, radius * 0.48, height * 0.05, 96, 1, false), trim, { y: topY + height * 0.025 });
      printHeight = bodyH * 0.88;
      printY = bottomY + bodyH * 0.53;
    } else if (productKey === "copo_termico") {
      var tumblerTop = radius * 1.08;
      var tumblerBottom = radius * 0.74;
      var lidH = height * 0.085;
      addMesh(group, new THREE.CylinderGeometry(tumblerTop, tumblerBottom, height, 160, 10, false), body);
      addMesh(group, new THREE.TorusGeometry(tumblerTop * 0.98, radius * 0.035, 16, 160), trim, { y: topY + radius * 0.015 }, { x: Math.PI / 2 });
      addMesh(group, new THREE.CylinderGeometry(tumblerTop * 1.02, tumblerTop * 0.96, lidH, 160, 2, false), trim, { y: topY + lidH * 0.45 });
      addMesh(group, new THREE.CylinderGeometry(tumblerTop * 0.46, tumblerTop * 0.5, lidH * 0.6, 96, 1, false), trim, { y: topY + lidH * 1.05 });
      addMesh(group, new THREE.CylinderGeometry(radius * 0.04, radius * 0.04, height * 0.95, 24, 1, false), trim, { x: radius * 0.42, y: topY + height * 0.36, z: radius * 0.12 }, { z: -0.16 });
      addMesh(group, new THREE.CylinderGeometry(tumblerBottom * 0.92, tumblerBottom, height * 0.055, 128, 1, false), trim, { y: bottomY + height * 0.025 });
      printHeight = height * 0.72;
      printY = -height * 0.1;
    } else if (productKey === "caneca") {
      var mugTop = radius * 1.04;
      var mugBottom = radius * 0.94;
      addMesh(group, new THREE.CylinderGeometry(mugTop, mugBottom, height, 160, 8, false), body);
      addMesh(group, new THREE.CylinderGeometry(mugTop * 0.88, mugTop * 0.9, height * 0.035, 128, 1, false), trim, { y: topY - height * 0.018 });
      addMesh(group, new THREE.TorusGeometry(mugTop * 0.98, radius * 0.035, 16, 160), trim, { y: topY + radius * 0.015 }, { x: Math.PI / 2 });
      addMesh(group, new THREE.TorusGeometry(mugBottom * 0.98, radius * 0.028, 16, 128), trim, { y: bottomY + radius * 0.035 }, { x: Math.PI / 2 });
      var handleCurve = new THREE.CatmullRomCurve3([
        new THREE.Vector3(radius * 1.03, height * 0.26, 0),
        new THREE.Vector3(radius * 1.5, height * 0.18, 0),
        new THREE.Vector3(radius * 1.64, 0, 0),
        new THREE.Vector3(radius * 1.5, -height * 0.18, 0),
        new THREE.Vector3(radius * 1.03, -height * 0.26, 0)
      ]);
      var mugHandle = addMesh(
        group,
        new THREE.TubeGeometry(handleCurve, 80, radius * 0.075, 18, false),
        body,
        { x: 0, y: height * 0.02, z: 0 }
      );
      mugHandle.castShadow = true;
      addMesh(group, new THREE.SphereGeometry(radius * 0.13, 32, 16), body, { x: radius * 1.02, y: height * 0.28, z: 0 }, null, { x: 0.72, y: 0.9, z: 0.58 });
      addMesh(group, new THREE.SphereGeometry(radius * 0.13, 32, 16), body, { x: radius * 1.02, y: -height * 0.24, z: 0 }, null, { x: 0.72, y: 0.9, z: 0.58 });
      printHeight = height * 0.74;
      printY = -height * 0.03;
    } else if (productKey === "copo_pers") {
      var cupTop = radius * 1.12;
      var cupBottom = radius * 0.72;
      addMesh(group, new THREE.CylinderGeometry(cupTop, cupBottom, height, 160, 8, false), body);
      addMesh(group, new THREE.CylinderGeometry(cupTop * 0.9, cupTop * 0.92, height * 0.04, 128, 1, false), trim, { y: topY - height * 0.02 });
      addMesh(group, new THREE.TorusGeometry(cupTop * 0.98, radius * 0.035, 16, 160), trim, { y: topY + radius * 0.012 }, { x: Math.PI / 2 });
      addMesh(group, new THREE.CylinderGeometry(cupBottom * 0.72, cupBottom * 0.62, height * 0.1, 96, 1, false), trim, { y: bottomY - height * 0.03 });
      addMesh(group, new THREE.CylinderGeometry(cupBottom * 1.08, cupBottom * 1.08, height * 0.035, 128, 1, false), trim, { y: bottomY - height * 0.095 });
      printHeight = height * 0.62;
      printY = height * 0.02;
    } else {
      var topRadius = productKey === "copo_termico" ? radius * 0.92 : productKey === "copo_pers" ? radius * 1.05 : radius;
      var bottomRadius = productKey === "copo_termico" ? radius * 0.78 : productKey === "copo_pers" ? radius * 0.82 : radius * 0.96;
      addMesh(group, new THREE.CylinderGeometry(topRadius, bottomRadius, height, 128, 8, false), body);
      addMesh(group, new THREE.TorusGeometry(topRadius * 0.99, radius * 0.035, 16, 128), trim, { y: topY + radius * 0.025 }, { x: Math.PI / 2 });
      addMesh(group, new THREE.TorusGeometry(bottomRadius * 0.98, radius * 0.03, 16, 128), trim, { y: bottomY + radius * 0.035 }, { x: Math.PI / 2 });
    }

    var printRadius = radius * 1.006;
    var printThetaStart = -Math.PI * 0.62;
    var printThetaLength = Math.PI * 1.24;
    var printGeom = new THREE.CylinderGeometry(printRadius, printRadius, printHeight, 128, 1, true, printThetaStart, printThetaLength);
    threePreview.printMesh = addMesh(group, printGeom, print, { y: printY });
    threePreview.printMesh.receiveShadow = false;

    threePreview.productGroup = group;
    threePreview.scene.add(group);
  }

  function parseNum(el, fallback) {
    var v = parseFloat(el && el.value);
    return isNaN(v) ? fallback : v;
  }

  function calculatePrice() {
    var product = document.getElementById("productSelect");
    var key = product ? product.value : "caneca";
    var base = BASE_PRICES[key] || 45;
    var size = DEFAULT_SIZES[key] || DEFAULT_SIZES.caneca;
    var d = size.diameter;
    var h = size.height;
    var sizeFactor = 1 + (d * h) / 500;
    var text = (document.getElementById("customText") && document.getElementById("customText").value) || "";
    var textExtra = text.trim().length > 0 ? 15 : 0;
    var total = base * sizeFactor + textExtra;
    return Math.round(total * 100) / 100;
  }

  function updatePriceDisplay() {
    var priceEl = document.getElementById("priceValue");
    if (priceEl) {
      priceEl.textContent =
        "R$ " +
        calculatePrice()
          .toFixed(2)
          .replace(".", ",");
    }
  }

  function drawMugPreview() {
    console.log("🖼️ drawMugPreview chamado");
    // Mantém o nome antigo para não quebrar a integração existente no formulário.
    initThreePreview();
    console.log("🔧 three initialized:", threePreview.initialized);
    var state = getCurrentFormState();
    if (threePreview.webglFailed) {
      drawCanvasFallbackPreview(state);
      return;
    }
    if (!threePreview.initialized) {
      console.warn("⛔ drawMugPreview abortado: Three não inicializou (veja erros de import map / módulo no console)");
      return;
    }

    updateGeometryFromForm(state);
    updateTextureFromForm(state);
    console.log("✅ drawMugPreview: geometria + textura OK");
  }

  function wrapText(context, text, x, y, maxWidth, lineHeight) {
    var words = text.split(/\s+/);
    var line = "";
    var yy = y;
    for (var n = 0; n < words.length; n++) {
      var testLine = line + words[n] + " ";
      if (context.measureText(testLine).width > maxWidth && n > 0) {
        context.fillText(line.trim(), x, yy);
        line = words[n] + " ";
        yy += lineHeight;
        if (yy > y + lineHeight * 3) break;
      } else {
        line = testLine;
      }
    }
    context.fillText(line.trim(), x, yy);
  }

  function getProductColor() {
    var el = document.getElementById("productColor");
    return el && el.value ? el.value : "#cbd5e1";
  }

  function clamp01(v) {
    return Math.max(0.08, Math.min(0.92, v));
  }

  function normalizeRotation(v) {
    var full = Math.PI * 2;
    var normalized = ((v + Math.PI) % full + full) % full - Math.PI;
    return normalized;
  }

  function setRangeValue(id, value) {
    var el = document.getElementById(id);
    if (el) el.value = String(value);
  }

  function syncPreviewControls() {
    setRangeValue("imageOffsetX", editState.imageX.toFixed(2));
    setRangeValue("imageOffsetY", editState.imageY.toFixed(2));
    setRangeValue("imageScale", editState.imageScale.toFixed(2));
    setRangeValue("textOffsetX", editState.textX.toFixed(2));
    setRangeValue("textOffsetY", editState.textY.toFixed(2));
    setRangeValue("textScale", editState.textScale.toFixed(2));
    setRangeValue("productRotation", editState.productRotation.toFixed(2));
    setRangeValue("productZoom", editState.productZoom.toFixed(2));

    document.querySelectorAll(".preview-mode-btn").forEach(function (btn) {
      btn.classList.toggle("active", btn.getAttribute("data-preview-mode") === editState.active);
    });
    document.querySelectorAll(".preview-control-group").forEach(function (group) {
      group.classList.toggle("is-hidden", group.getAttribute("data-control-target") !== editState.active);
    });

    var canvas = document.getElementById("previewCanvas");
    if (canvas) {
      canvas.style.cursor = editState.active === "product" ? "grab" : "move";
    }
    if (threePreview.controls) {
      threePreview.controls.enabled = false;
    }
  }

  function setPositionPreset(position) {
    if (position === "left") {
      editState.imageX = 0.35;
      editState.textX = 0.35;
    } else if (position === "right") {
      editState.imageX = 0.65;
      editState.textX = 0.65;
    } else {
      editState.imageX = 0.5;
      editState.textX = 0.5;
    }
    editState.imageY = 0.38;
    editState.textY = 0.74;
    syncPreviewControls();
  }

  function resetPreviewEdit() {
    editState.imageX = 0.5;
    editState.imageY = 0.38;
    editState.imageScale = 1;
    editState.textX = 0.5;
    editState.textY = 0.74;
    editState.textScale = 1;
    editState.productRotation = 0;
    editState.productZoom = 1;
    syncPreviewControls();
    drawMugPreview();
  }

  function pointerToNormalized(ev, canvas) {
    var rect = canvas.getBoundingClientRect();
    return {
      x: clamp01((ev.clientX - rect.left) / rect.width),
      y: clamp01((ev.clientY - rect.top) / rect.height)
    };
  }

  function pickEditableTarget(pos, state) {
    var textDistance = Math.abs(pos.x - editState.textX) + Math.abs(pos.y - editState.textY);
    var imageDistance = Math.abs(pos.x - editState.imageX) + Math.abs(pos.y - editState.imageY);
    if ((state.text || "").trim() && textDistance < imageDistance + 0.08) return "text";
    return "image";
  }

  function moveEditableTarget(target, pos) {
    if (target === "text") {
      editState.textX = pos.x;
      editState.textY = pos.y;
    } else {
      editState.imageX = pos.x;
      editState.imageY = pos.y;
    }
    editState.active = target;
    syncPreviewControls();
  }

  function resizeEditableTarget(target, direction) {
    var factor = direction < 0 ? 1.08 : 0.92;
    if (target === "text") {
      editState.textScale = Math.max(0.55, Math.min(1.8, editState.textScale * factor));
    } else {
      editState.imageScale = Math.max(0.45, Math.min(2.2, editState.imageScale * factor));
    }
    syncPreviewControls();
  }

  function setPreviewMode(mode) {
    editState.active = mode === "text" || mode === "product" ? mode : "image";
    editState.dragging = null;
    syncPreviewControls();
  }

  function wireEditableCanvas() {
    var canvas = document.getElementById("previewCanvas");
    if (!canvas) return;

    canvas.addEventListener("pointerdown", function (ev) {
      if (editState.active === "product") {
        editState.dragging = "product";
        editState.dragStartX = ev.clientX;
        editState.dragStartRotation = editState.productRotation;
        if (threePreview.controls) threePreview.controls.enabled = false;
        canvas.style.cursor = "grabbing";
        canvas.setPointerCapture(ev.pointerId);
        ev.preventDefault();
        return;
      }
      var pos = pointerToNormalized(ev, canvas);
      var state = getCurrentFormState();
      var target = editState.active === "text" || editState.active === "image" ? editState.active : pickEditableTarget(pos, state);
      editState.dragging = target;
      moveEditableTarget(target, pos);
      if (threePreview.controls) threePreview.controls.enabled = false;
      canvas.setPointerCapture(ev.pointerId);
      drawMugPreview();
      ev.preventDefault();
    });

    canvas.addEventListener("pointermove", function (ev) {
      if (!editState.dragging) return;
      if (editState.dragging === "product") {
        editState.productRotation = normalizeRotation(editState.dragStartRotation + (ev.clientX - editState.dragStartX) * 0.015);
        syncPreviewControls();
        updateGeometryFromForm(getCurrentFormState());
        ev.preventDefault();
        return;
      }
      moveEditableTarget(editState.dragging, pointerToNormalized(ev, canvas));
      drawMugPreview();
      ev.preventDefault();
    });

    function stopDragging(ev) {
      if (!editState.dragging) return;
      editState.dragging = null;
      syncPreviewControls();
      try {
        canvas.releasePointerCapture(ev.pointerId);
      } catch (e) {
        // captura pode já ter sido liberada pelo navegador
      }
    }

    canvas.addEventListener("pointerup", stopDragging);
    canvas.addEventListener("pointercancel", stopDragging);
    canvas.addEventListener("lostpointercapture", function () {
      editState.dragging = null;
      syncPreviewControls();
    });

    canvas.addEventListener("wheel", function (ev) {
      if (editState.active === "product") return;
      resizeEditableTarget(editState.active || "image", ev.deltaY);
      drawMugPreview();
      ev.preventDefault();
    }, { passive: false });
  }

  function wirePreviewControls() {
    if (editState.controlsWired) return;
    editState.controlsWired = true;

    document.querySelectorAll(".preview-mode-btn").forEach(function (btn) {
      btn.addEventListener("click", function () {
        setPreviewMode(btn.getAttribute("data-preview-mode"));
      });
    });

    function bindRange(id, setter) {
      var el = document.getElementById(id);
      if (!el) return;
      el.addEventListener("input", function () {
        setter(parseFloat(el.value));
        syncPreviewControls();
        drawMugPreview();
      });
    }

    bindRange("imageOffsetX", function (v) { editState.imageX = clamp01(v); });
    bindRange("imageOffsetY", function (v) { editState.imageY = clamp01(v); });
    bindRange("imageScale", function (v) { editState.imageScale = Math.max(0.45, Math.min(2.2, v)); });
    bindRange("textOffsetX", function (v) { editState.textX = clamp01(v); });
    bindRange("textOffsetY", function (v) { editState.textY = clamp01(v); });
    bindRange("textScale", function (v) { editState.textScale = Math.max(0.55, Math.min(1.8, v)); });
    bindRange("productRotation", function (v) { editState.productRotation = normalizeRotation(v); });
    bindRange("productZoom", function (v) { editState.productZoom = Math.max(0.75, Math.min(1.7, v)); });

    var resetBtn = document.getElementById("resetPreviewEdit");
    if (resetBtn) {
      resetBtn.addEventListener("click", function () {
        resetPreviewEdit();
      });
    }

    syncPreviewControls();
  }

  if (typeof Path2D !== "undefined" && !CanvasRenderingContext2D.prototype.roundRect) {
    CanvasRenderingContext2D.prototype.roundRect = function (x, y, w, h, r) {
      r = Math.min(r, w / 2, h / 2);
      this.moveTo(x + r, y);
      this.arcTo(x + w, y, x + w, y + h, r);
      this.arcTo(x + w, y + h, x, y + h, r);
      this.arcTo(x, y + h, x, y, r);
      this.arcTo(x, y, x + w, y, r);
      this.closePath();
    };
  }

  function validateForm() {
    var ok = true;
    var groups = document.querySelectorAll("#personalizeForm .form-group");
    groups.forEach(function (g) {
      g.classList.remove("invalid");
    });

    function invalidate(id, msg) {
      var fg = document.getElementById(id) && document.getElementById(id).closest(".form-group");
      if (fg) {
        fg.classList.add("invalid");
        var em = fg.querySelector(".error-msg");
        if (em) em.textContent = msg;
      }
      ok = false;
    }

    var fileInput = document.getElementById("imageUpload");
    if (!fileInput || !fileInput.files || fileInput.files.length === 0) {
      invalidate("imageUpload", "Envie uma imagem (PNG ou JPG).");
    } else {
      var f = fileInput.files[0];
      if (f.size > 4 * 1024 * 1024) {
        invalidate("imageUpload", "Arquivo muito grande (máx. 4 MB).");
      } else if (!/^image\/(jpeg|png|webp)$/i.test(f.type)) {
        invalidate("imageUpload", "Use JPG, PNG ou WebP.");
      }
    }

    var text = document.getElementById("customText");
    if (text && text.value.length > 200) invalidate("customText", "Máximo 200 caracteres.");

    return ok;
  }

  function loadImageFile(file, cb) {
    var reader = new FileReader();
    reader.onload = function (e) {
      var img = new Image();
      img.onload = function () {
        cb(img);
      };
      img.onerror = function () {
        cb(null);
      };
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
  }

  function wire() {
    var product = document.getElementById("productSelect");
    var color = document.getElementById("productColor");
    var text = document.getElementById("customText");
    var font = document.getElementById("fontSelect");
    var position = document.getElementById("positionSelect");
    var fileInput = document.getElementById("imageUpload");

    wirePreviewControls();
    wireEditableCanvas();

    [product, color, text, font, position].forEach(function (el) {
      if (!el) return;
      el.addEventListener("input", function () {
        updatePriceDisplay();
        drawMugPreview();
      });
      el.addEventListener("change", function () {
        updatePriceDisplay();
        drawMugPreview();
      });
    });

    if (position) {
      position.addEventListener("change", function () {
        setPositionPreset(position.value);
        drawMugPreview();
      });
    }

    if (fileInput) {
      fileInput.addEventListener("change", function () {
        if (fileInput.files && fileInput.files[0]) {
          loadImageFile(fileInput.files[0], function (img) {
            uploadedImage = img;
            drawMugPreview();
          });
        }
      });
    }

    document.getElementById("btnPreview") &&
      document.getElementById("btnPreview").addEventListener("click", function (e) {
        e.preventDefault();
        if (!validateForm()) {
          if (window.showToast) window.showToast("Corrija os campos destacados.", "error");
          return;
        }
        drawMugPreview();
        updatePriceDisplay();
        if (window.showToast) window.showToast("Prévia gerada! Confira ao lado.", "success");
      });

    document.getElementById("btnFinalize") &&
      document.getElementById("btnFinalize").addEventListener("click", async function (e) {
        e.preventDefault();
        var user = window.getCurrentUser && window.getCurrentUser();
        if (!user) {
          if (window.showToast) window.showToast("Faça login para finalizar o pedido.", "error");
          setTimeout(function () {
            window.location.href = "login.html";
          }, 1200);
          return;
        }
        if (!validateForm()) {
          if (window.showToast) window.showToast("Preencha e valide o formulário.", "error");
          return;
        }

        var productSel = document.getElementById("productSelect");
        var productName = productSel.options[productSel.selectedIndex].text;
        var reader = new FileReader();
        reader.onload = async function (ev) {
          var order = {
            userEmail: user.email,
            userName: user.name,
            productKey: productSel.value,
            productName: productName,
            diameter: (DEFAULT_SIZES[productSel.value] || DEFAULT_SIZES.caneca).diameter,
            height: (DEFAULT_SIZES[productSel.value] || DEFAULT_SIZES.caneca).height,
            color: color ? color.value : "",
            text: text ? text.value : "",
            font: font ? font.value : "",
            position: position ? position.value : "center",
            imageX: editState.imageX,
            imageY: editState.imageY,
            imageScale: editState.imageScale,
            textX: editState.textX,
            textY: editState.textY,
            textScale: editState.textScale,
            imageDataUrl: ev.target.result,
            price: calculatePrice(),
            status: "Em análise",
          };
          var result = window.addOrder ? await window.addOrder(order) : { ok: false };
          if (!result.ok) {
            if (window.showToast) window.showToast(result.message || "Erro ao salvar pedido.", "error");
            return;
          }
          if (window.showToast) window.showToast("Pedido registrado com sucesso!", "success");
          setTimeout(function () {
            window.location.href = "pedidos.html";
          }, 900);
        };
        reader.readAsDataURL(fileInput.files[0]);
      });

    loadBasePrices().then(function () {
      console.log("💰 preços carregados, chamando drawMugPreview");
      updatePriceDisplay();
      drawMugPreview();
    });

    window.addEventListener("storage", function (ev) {
      if (ev.key === "studioz_prices_updated_at") loadBasePrices();
    });

    document.addEventListener("visibilitychange", function () {
      if (!document.hidden) loadBasePrices();
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", wire);
  } else {
    wire();
  }
})();
