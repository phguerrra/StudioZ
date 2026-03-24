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
    var canvas = document.getElementById("previewCanvas");
    var ctx = canvas ? canvas.getContext("2d") : null;
    if (!canvas || !ctx) return;
    var w = (canvas.width = 320);
    var h = (canvas.height = 360);
    ctx.clearRect(0, 0, w, h);

    var cx = w / 2;
    var mugW = 140;
    var mugH = 180;
    var mugX = cx - mugW / 2;
    var mugY = 60;

    ctx.fillStyle = getProductColor();
    ctx.beginPath();
    ctx.roundRect(mugX, mugY, mugW, mugH, 12);
    ctx.fill();

    ctx.strokeStyle = "rgba(0,0,0,0.12)";
    ctx.lineWidth = 2;
    ctx.stroke();

    var imgAreaX = mugX + 15;
    var imgAreaY = mugY + 25;
    var imgAreaW = mugW - 30;
    var imgAreaH = 95;

    if (uploadedImage && uploadedImage.complete) {
      ctx.save();
      ctx.beginPath();
      ctx.roundRect(imgAreaX, imgAreaY, imgAreaW, imgAreaH, 8);
      ctx.clip();
      var ir = uploadedImage.width / uploadedImage.height;
      var boxr = imgAreaW / imgAreaH;
      var dw, dh, ox, oy;
      if (ir > boxr) {
        dh = imgAreaH;
        dw = dh * ir;
        ox = imgAreaX + (imgAreaW - dw) / 2;
        oy = imgAreaY;
      } else {
        dw = imgAreaW;
        dh = dw / ir;
        ox = imgAreaX;
        oy = imgAreaY + (imgAreaH - dh) / 2;
      }
      ctx.drawImage(uploadedImage, ox, oy, dw, dh);
      ctx.restore();
    } else {
      ctx.fillStyle = "rgba(255,255,255,0.35)";
      ctx.fillRect(imgAreaX, imgAreaY, imgAreaW, imgAreaH);
      ctx.fillStyle = "#64748b";
      ctx.font = "13px Outfit, sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("Envie uma imagem", cx, imgAreaY + imgAreaH / 2 - 6);
      ctx.fillText("para ver aqui", cx, imgAreaY + imgAreaH / 2 + 12);
    }

    var text = (document.getElementById("customText") && document.getElementById("customText").value) || "";
    var fontSel = document.getElementById("fontSelect");
    var fontFamily = fontSel ? fontSel.value : "Outfit";
    var pos = document.getElementById("positionSelect") ? document.getElementById("positionSelect").value : "center";

    ctx.font = "600 14px '" + fontFamily + "', sans-serif";
    ctx.fillStyle = "#1e293b";
    var textY = mugY + mugH - 28;
    var textX = cx;
    ctx.textAlign = "center";
    if (pos === "left") {
      ctx.textAlign = "left";
      textX = mugX + 18;
    } else if (pos === "right") {
      ctx.textAlign = "right";
      textX = mugX + mugW - 18;
    }
    if (text.trim()) {
      var maxW = mugW - 24;
      wrapText(ctx, text.trim(), textX, textY, maxW, 18);
    }

    ctx.strokeStyle = getProductColor();
    ctx.lineWidth = 10;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.arc(mugX + mugW + 5, mugY + mugH / 2, 38, -Math.PI * 0.35, Math.PI * 0.35);
    ctx.stroke();
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
