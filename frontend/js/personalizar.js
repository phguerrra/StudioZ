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

  async function loadBasePrices() {
    try {
      var res = await fetch("/api/prices");
      var data = await res.json();
      if (!res.ok || !data.ok || !Array.isArray(data.prices)) return;
      data.prices.forEach(function (p) {
        if (p && p.productKey && typeof p.basePrice === "number") {
          BASE_PRICES[p.productKey] = p.basePrice;
        }
      });
    } catch (e) {
      // mantém defaults
    }
  }

  var uploadedImage = null;

  var THREE_TEXTURE_W = 1024;
  var THREE_TEXTURE_H = 512;

  var threePreview = {
    initialized: false,
    renderer: null,
    scene: null,
    camera: null,
    controls: null,
    cylinderMesh: null,
    cylinderMaterial: null,
    textureCanvas: null,
    textureCtx: null,
    texture: null,
    animId: null,
    lastGeometryKey: ""
  };

  function getCurrentFormState() {
    var productEl = document.getElementById("productSelect");
    var diameterEl = document.getElementById("diameter");
    var heightEl = document.getElementById("height");
    var colorEl = document.getElementById("productColor");
    var textEl = document.getElementById("customText");
    var fontEl = document.getElementById("fontSelect");
    var positionEl = document.getElementById("positionSelect");

    return {
      productKey: productEl ? productEl.value : "caneca",
      diameterCm: diameterEl ? parseNum(diameterEl, 8) : 8,
      heightCm: heightEl ? parseNum(heightEl, 10) : 10,
      color: colorEl && colorEl.value ? colorEl.value : "#cbd5e1",
      text: textEl && textEl.value ? textEl.value : "",
      fontFamily: fontEl && fontEl.value ? fontEl.value : "Outfit",
      position: positionEl && positionEl.value ? positionEl.value : "center",
      image: uploadedImage
    };
  }

  function getShapeMultipliers(productKey) {
    // Multiplicadores para criar "silhuetas" diferentes.
    // Mantemos o cálculo simples e ainda respeitamos os inputs de diâmetro/altura.
    var m = {
      radiusMul: 1,
      heightMul: 1
    };
    if (productKey === "caneca") {
      m.radiusMul = 1.15;
      m.heightMul = 0.9;
    } else if (productKey === "copo_termico") {
      m.radiusMul = 1.02;
      m.heightMul = 1.03;
    } else if (productKey === "garrafa") {
      m.radiusMul = 0.72;
      m.heightMul = 1.35;
    } else if (productKey === "copo_pers") {
      m.radiusMul = 0.86;
      m.heightMul = 1.0;
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
    threePreview.renderer = new THREE.WebGLRenderer({
      canvas: canvas,
      antialias: true,
      alpha: true,
      preserveDrawingBuffer: false
    });
    threePreview.renderer.setClearColor(0x000000, 0);

    threePreview.camera = new THREE.PerspectiveCamera(45, 1, 0.1, 200);
    threePreview.camera.position.set(0, 2, 6);

    // Iluminação suave para destacar textura sem "estourar".
    var hemi = new THREE.HemisphereLight(0xffffff, 0x94a3b8, 0.9);
    threePreview.scene.add(hemi);

    var dir = new THREE.DirectionalLight(0xffffff, 0.85);
    dir.position.set(2.8, 5.2, 3.2);
    threePreview.scene.add(dir);

    threePreview.cylinderMaterial = new THREE.MeshStandardMaterial({
      color: hexToNumber(getProductColor()),
      roughness: 0.6,
      metalness: 0.05
    });

    // Geometria inicial (vai ser recalculada conforme diâmetro/altura/produto).
    threePreview.cylinderMesh = new THREE.Mesh(
      new THREE.CylinderGeometry(0.8, 0.8, 2.0, 64, 1, true),
      threePreview.cylinderMaterial
    );
    threePreview.cylinderMesh.position.y = 0;
    threePreview.scene.add(threePreview.cylinderMesh);

    threePreview.controls = new OrbitControls(threePreview.camera, threePreview.renderer.domElement);
    threePreview.controls.enableDamping = true;
    threePreview.controls.dampingFactor = 0.08;
    threePreview.controls.enablePan = false;
    threePreview.controls.minDistance = 2;
    threePreview.controls.maxDistance = 20;

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

  function drawCoverImageToTexture(ctx, img, W, H, position) {
    // position define "onde" o conteúdo aparece na superfície cilíndrica.
    var alignX = 0.5;
    if (position === "left") alignX = 0.25;
    if (position === "right") alignX = 0.75;

    var iw = img.width;
    var ih = img.height;
    if (!iw || !ih) return;

    var scale = Math.max(W / iw, H / ih);
    var dw = iw * scale;
    var dh = ih * scale;

    var dx = (W - dw) * alignX;
    var dy = (H - dh) / 2;

    ctx.drawImage(img, dx, dy, dw, dh);
  }

  function drawPlaceholderImageToTexture(ctx, W, H) {
    ctx.fillStyle = "rgba(255,255,255,0.35)";
    ctx.fillRect(W * 0.12, H * 0.23, W * 0.76, H * 0.28);

    ctx.fillStyle = "#64748b";
    ctx.font = "13px Outfit, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("Envie uma imagem", W / 2, H * 0.23 + (H * 0.28) / 2 - 6);
    ctx.fillText("para ver aqui", W / 2, H * 0.23 + (H * 0.28) / 2 + 12);
  }

  function updateTextureFromForm(state) {
    ensureTextureCanvas();
    var ctx = threePreview.textureCtx;
    var W = THREE_TEXTURE_W;
    var H = THREE_TEXTURE_H;

    // Fundo com a cor do produto (assim o input de cor sempre aparece).
    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = state.color;
    ctx.fillRect(0, 0, W, H);

    if (state.image && state.image.complete) {
      ctx.save();
      drawCoverImageToTexture(ctx, state.image, W, H, state.position);
      ctx.restore();
    } else {
      drawPlaceholderImageToTexture(ctx, W, H);
    }

    // Texto sobreposto (Canvas 2D -> textura no cilindro 3D).
    var text = (state.text || "").trim();
    if (text) {
      var fontSize = Math.round(H * 0.09); // ~46px no padrão
      var lineHeight = Math.round(fontSize * 1.05);
      var maxW = W * 0.78;

      ctx.font = "600 " + fontSize + "px '" + state.fontFamily + "', sans-serif";
      ctx.fillStyle = "#1e293b";

      ctx.textAlign = "center";
      var x = W / 2;
      if (state.position === "left") {
        ctx.textAlign = "left";
        x = W * 0.12;
      } else if (state.position === "right") {
        ctx.textAlign = "right";
        x = W * 0.88;
      }

      var y = H * 0.74; // perto do "rodapé" do layout
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

    if (threePreview.cylinderMaterial) {
      threePreview.cylinderMaterial.map = threePreview.texture;
      threePreview.cylinderMaterial.color.set(hexToNumber(state.color));
      threePreview.cylinderMaterial.needsUpdate = true;
    }
  }

  function updateGeometryFromForm(state) {
    if (!threePreview.cylinderMesh) return;

    var multipliers = getShapeMultipliers(state.productKey);
    var cmToWorld = 0.2;

    var radiusCm = state.diameterCm / 2;
    var radiusWorld = Math.max(0.08, radiusCm * multipliers.radiusMul * cmToWorld);
    var heightWorld = Math.max(0.08, state.heightCm * multipliers.heightMul * cmToWorld);

    // Chave para evitar recriar geometria em updates pequenos.
    var geometryKey = [state.productKey, radiusWorld.toFixed(3), heightWorld.toFixed(3)].join("|");
    if (threePreview.lastGeometryKey !== geometryKey) {
      threePreview.lastGeometryKey = geometryKey;

      var geom = new THREE.CylinderGeometry(radiusWorld, radiusWorld, heightWorld, 64, 1, true);
      if (threePreview.cylinderMesh.geometry) threePreview.cylinderMesh.geometry.dispose();
      threePreview.cylinderMesh.geometry = geom;
    }

    // Ajusta câmera para caber no cilindro.
    var cameraDist = radiusWorld * 5 + 2.1;
    threePreview.camera.position.set(0, heightWorld * 0.42, cameraDist);
    if (threePreview.controls && threePreview.controls.target) {
      threePreview.controls.target.set(0, 0, 0);
    }

    // Visual inicial coerente com a posição escolhida.
    var rot = 0;
    if (state.position === "left") rot = Math.PI / 6;
    if (state.position === "right") rot = -Math.PI / 6;
    if (threePreview.cylinderMesh) threePreview.cylinderMesh.rotation.y = rot;
  }

  function parseNum(el, fallback) {
    var v = parseFloat(el && el.value);
    return isNaN(v) ? fallback : v;
  }

  function calculatePrice() {
    var product = document.getElementById("productSelect");
    var key = product ? product.value : "caneca";
    var base = BASE_PRICES[key] || 45;
    var d = parseNum(document.getElementById("diameter"), 8);
    var h = parseNum(document.getElementById("height"), 10);
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
    var diameter = document.getElementById("diameter");
    var height = document.getElementById("height");
    var color = document.getElementById("productColor");
    var text = document.getElementById("customText");
    var font = document.getElementById("fontSelect");
    var position = document.getElementById("positionSelect");
    var fileInput = document.getElementById("imageUpload");

    [product, diameter, height, color, text, font, position].forEach(function (el) {
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
            diameter: parseNum(diameter, 8),
            height: parseNum(height, 10),
            color: color ? color.value : "",
            text: text ? text.value : "",
            font: font ? font.value : "",
            position: position ? position.value : "center",
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
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", wire);
  } else {
    wire();
  }
})();
