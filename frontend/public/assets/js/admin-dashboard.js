(function () {
  "use strict";

  function toCurrency(v) {
    return Number(v || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  }

  function badgeClass(status) {
    if (status === "Em análise") return "status-analise";
    if (status === "Em produção") return "status-producao";
    if (status === "Pronto") return "status-pronto";
    if (status === "Entregue") return "status-entregue";
    return "status-analise";
  }

  function escapeHtml(s) {
    return String(s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function setText(id, value) {
    var el = document.getElementById(id);
    if (el) el.textContent = value;
  }

  function isToday(dateValue) {
    if (!dateValue) return false;
    var date = new Date(dateValue);
    if (Number.isNaN(date.getTime())) return false;
    var now = new Date();
    return date.getFullYear() === now.getFullYear() && date.getMonth() === now.getMonth() && date.getDate() === now.getDate();
  }

  async function loadAll() {
    var statsRes = await window.AdminAuth.getStats();
    var ordersRes = await window.AdminAuth.getOrders();
    var contactsRes = await window.AdminAuth.getContacts();
    var pricesRes = await window.AdminAuth.getPrices();

    if (!statsRes.ok || !ordersRes.ok || !contactsRes.ok || !pricesRes.ok) {
      if (window.showToast) window.showToast("Falha ao carregar dashboard admin.", "error");
      return;
    }

    var orders = ordersRes.orders || [];
    var contacts = contactsRes.contacts || [];
    var prices = pricesRes.prices || [];
    renderStats(statsRes.stats, orders);
    renderInsights(orders, contacts, prices);
    renderOrders(orders);
    renderPrices(prices);
    renderContacts(contacts);
  }

  function renderStats(stats, orders) {
    var totalOrders = stats.totalOrders || 0;
    var totalRevenue = stats.totalRevenue || 0;
    var averageTicket = totalOrders > 0 ? totalRevenue / totalOrders : 0;
    var todayOrders = orders.filter(function (o) {
      return isToday(o.createdAt);
    }).length;

    setText("kpiTotalOrders", String(totalOrders));
    setText("kpiTodayOrders", String(todayOrders));
    setText("kpiRevenue", toCurrency(totalRevenue));
    setText("kpiAverageTicket", toCurrency(averageTicket));
    setText("kpiUsers", String(stats.totalUsers || 0));
    setText("kpiContacts", String(stats.totalContacts || 0));
    setText("kpiAnalise", String((stats.byStatus && stats.byStatus["Em análise"]) || 0));
    setText("kpiProducao", String((stats.byStatus && stats.byStatus["Em produção"]) || 0));
    setText("kpiPronto", String((stats.byStatus && stats.byStatus["Pronto"]) || 0));
    setText("kpiEntregue", String((stats.byStatus && stats.byStatus["Entregue"]) || 0));
  }

  function renderInsights(orders, contacts, prices) {
    renderAlerts(orders, contacts, prices);
    renderTopProducts(orders);
    renderSalesChart(orders);
  }

  function renderSalesChart(orders) {
    var canvas = document.getElementById("adminSalesChart");
    if (!canvas) return;
    var ctx = canvas.getContext("2d");
    var w = canvas.width;
    var h = canvas.height;
    ctx.clearRect(0, 0, w, h);

    var days = [];
    var now = new Date();
    for (var i = 6; i >= 0; i--) {
      var d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i);
      days.push({
        key: d.toISOString().slice(0, 10),
        label: d.toLocaleDateString("pt-BR", { weekday: "short" }).replace(".", ""),
        value: 0
      });
    }

    orders.forEach(function (o) {
      if (!o.createdAt) return;
      var date = new Date(o.createdAt);
      if (Number.isNaN(date.getTime())) return;
      var key = date.toISOString().slice(0, 10);
      var day = days.find(function (item) { return item.key === key; });
      if (day) day.value += Number(o.price || 0);
    });

    var max = Math.max.apply(null, days.map(function (d) { return d.value; }).concat([1]));
    var pad = 34;
    var chartW = w - pad * 2;
    var chartH = h - 62;
    var barGap = 18;
    var barW = Math.max(18, (chartW - barGap * (days.length - 1)) / days.length);

    ctx.fillStyle = "#f8fafc";
    ctx.fillRect(0, 0, w, h);

    ctx.strokeStyle = "#e2e8f0";
    ctx.lineWidth = 1;
    for (var grid = 0; grid <= 3; grid++) {
      var gy = pad + (chartH / 3) * grid;
      ctx.beginPath();
      ctx.moveTo(pad, gy);
      ctx.lineTo(w - pad, gy);
      ctx.stroke();
    }

    days.forEach(function (day, index) {
      var x = pad + index * (barW + barGap);
      var barH = Math.max(4, (day.value / max) * (chartH - 12));
      var y = pad + chartH - barH;
      var grad = ctx.createLinearGradient(0, y, 0, pad + chartH);
      grad.addColorStop(0, "#3b82f6");
      grad.addColorStop(1, "#ff4fa3");
      ctx.fillStyle = grad;
      roundRect(ctx, x, y, barW, barH, 8);
      ctx.fill();

      ctx.fillStyle = "#64748b";
      ctx.font = "700 12px Outfit, sans-serif";
      ctx.textAlign = "center";
      ctx.fillText(day.label, x + barW / 2, h - 16);
    });

    ctx.fillStyle = "#0f172a";
    ctx.font = "800 13px Outfit, sans-serif";
    ctx.textAlign = "left";
    ctx.fillText("Receita por dia", pad, 20);
  }

  function roundRect(ctx, x, y, w, h, r) {
    var radius = Math.min(r, w / 2, h / 2);
    ctx.beginPath();
    ctx.moveTo(x + radius, y);
    ctx.arcTo(x + w, y, x + w, y + h, radius);
    ctx.arcTo(x + w, y + h, x, y + h, radius);
    ctx.arcTo(x, y + h, x, y, radius);
    ctx.arcTo(x, y, x + w, y, radius);
    ctx.closePath();
  }

  function renderAlerts(orders, contacts, prices) {
    var host = document.getElementById("adminAlertsList");
    if (!host) return;

    var pending = orders.filter(function (o) {
      return (o.status || "Em análise") === "Em análise";
    }).length;
    var production = orders.filter(function (o) {
      return o.status === "Em produção";
    }).length;
    var ready = orders.filter(function (o) {
      return o.status === "Pronto";
    }).length;
    var missingImage = orders.filter(function (o) {
      return !o.imageDataUrl;
    }).length;
    var pricesWithoutValue = prices.filter(function (p) {
      return Number(p.basePrice || 0) <= 0;
    }).length;

    var alerts = [
      { icon: "fa-magnifying-glass", label: "Pedidos aguardando análise", value: pending, target: "pedidos" },
      { icon: "fa-gears", label: "Pedidos em produção", value: production, target: "pedidos" },
      { icon: "fa-check", label: "Pedidos prontos para entrega", value: ready, target: "pedidos" },
      { icon: "fa-image", label: "Pedidos sem imagem enviada", value: missingImage, target: "pedidos" },
      { icon: "fa-tag", label: "Produtos sem preço base", value: pricesWithoutValue, target: "precos" },
      { icon: "fa-envelope", label: "Mensagens no histórico", value: contacts.length, target: "contatos" }
    ];

    host.innerHTML = alerts
      .map(function (item) {
        return (
          '<button type="button" class="admin-alert-item" data-scroll-target="' +
          item.target +
          '">' +
          '<span class="admin-alert-icon"><i class="fas ' +
          item.icon +
          '"></i></span>' +
          "<span>" +
          escapeHtml(item.label) +
          "</span>" +
          "<strong>" +
          item.value +
          "</strong>" +
          "</button>"
        );
      })
      .join("");
  }

  function renderTopProducts(orders) {
    var host = document.getElementById("adminTopProducts");
    if (!host) return;

    if (!orders.length) {
      host.innerHTML = '<div class="admin-empty-state">Ainda não há pedidos para ranquear produtos.</div>';
      return;
    }

    var counts = {};
    orders.forEach(function (o) {
      var key = o.productName || o.productKey || "Produto sem nome";
      counts[key] = (counts[key] || 0) + 1;
    });

    var ranking = Object.keys(counts)
      .map(function (name) {
        return { name: name, count: counts[name] };
      })
      .sort(function (a, b) {
        return b.count - a.count;
      })
      .slice(0, 5);

    var max = ranking[0] ? ranking[0].count : 1;
    host.innerHTML = ranking
      .map(function (item, index) {
        var width = Math.max(8, Math.round((item.count / max) * 100));
        return (
          '<div class="admin-ranking-item">' +
          '<div class="admin-ranking-top"><span>' +
          (index + 1) +
          ". " +
          escapeHtml(item.name) +
          "</span><strong>" +
          item.count +
          "</strong></div>" +
          '<div class="admin-ranking-bar"><span style="width:' +
          width +
          '%"></span></div>' +
          "</div>"
        );
      })
      .join("");
  }

  function scrollToAdminSection(id) {
    var target = document.getElementById(id);
    if (target) target.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function setAdminTab(tab) {
    var next = tab || "overview";
    document.querySelectorAll(".admin-tab").forEach(function (btn) {
      btn.classList.toggle("active", btn.getAttribute("data-admin-tab") === next);
    });
    document.querySelectorAll(".admin-nav [data-tab-target]").forEach(function (link) {
      link.classList.toggle("active", link.getAttribute("data-tab-target") === next);
    });
    document.querySelectorAll(".admin-tab-panel").forEach(function (panel) {
      panel.classList.toggle("active", panel.getAttribute("data-admin-panel") === next);
    });
    if (next === "overview") renderSalesChart(window.__studiozAdminOrders || []);
  }

  function wireDashboardNavigation() {
    document.addEventListener("click", function (e) {
      var tabTrigger = e.target.closest("[data-tab-target]");
      if (tabTrigger) {
        e.preventDefault();
        setAdminTab(tabTrigger.getAttribute("data-tab-target"));
        return;
      }
      var trigger = e.target.closest("[data-scroll-target]");
      if (!trigger) return;
      var id = trigger.getAttribute("data-scroll-target");
      if (!id) return;
      e.preventDefault();
      scrollToAdminSection(id);
    });
  }

  function renderOrders(orders) {
    window.__studiozAdminOrders = orders;
    var tbody = document.getElementById("adminOrdersBody");
    setText("ordersCountLabel", orders.length + (orders.length === 1 ? " pedido" : " pedidos"));
    tbody.innerHTML = "";

    if (!orders.length) {
      tbody.innerHTML = '<tr><td colspan="7">Nenhum pedido encontrado.</td></tr>';
      return;
    }

    orders.forEach(function (o) {
      var tr = document.createElement("tr");
      tr.innerHTML =
        "<td>#" +
        o.id +
        "</td>" +
        "<td>" +
        escapeHtml(o.userName || "-") +
        "<br /><small>" +
        escapeHtml(o.userEmail || "-") +
        "</small></td>" +
        "<td>" +
        escapeHtml(o.productName || "-") +
        "</td>" +
        "<td>" +
        toCurrency(o.price || 0) +
        "</td>" +
        '<td><span class="status-badge ' +
        badgeClass(o.status) +
        '">' +
        escapeHtml(o.status || "Em análise") +
        "</span></td>" +
        "<td>" +
        new Date(o.createdAt).toLocaleString("pt-BR") +
        "</td>" +
        '<td style="display:flex;gap:0.5rem;align-items:center;flex-wrap:wrap;">' +
        '<button class="btn btn-outline btn-small admin-details-btn" data-id="' +
        o.id +
        '"><i class="fas fa-eye"></i> Detalhes</button>' +
        '<button class="btn btn-danger btn-small admin-delete-btn" data-id="' +
        o.id +
        '" data-label="Pedido #' +
        o.id +
        '"><i class="fas fa-trash"></i> Excluir</button>' +
        '<select class="admin-status-select" data-id="' +
        o.id +
        '" style="padding:0.35rem;border-radius:8px;border:1px solid #dbeafe;">' +
        statusOptions(o.status) +
        "</select></td>";
      tbody.appendChild(tr);
    });

    tbody.querySelectorAll(".admin-status-select").forEach(function (sel) {
      sel.addEventListener("change", async function () {
        var id = sel.getAttribute("data-id");
        var result = await window.AdminAuth.updateOrderStatus(id, sel.value);
        if (!result.ok) {
          if (window.showToast) window.showToast(result.message || "Falha ao atualizar status.", "error");
          return;
        }
        if (window.showToast) window.showToast("Status do pedido atualizado.", "success");
        loadAll();
      });
    });

    tbody.querySelectorAll(".admin-details-btn").forEach(function (btn) {
      btn.addEventListener("click", async function () {
        var id = btn.getAttribute("data-id");
        openOrderModal(id);
      });
    });

    tbody.querySelectorAll(".admin-delete-btn").forEach(function (btn) {
      btn.addEventListener("click", async function () {
        var id = btn.getAttribute("data-id");
        deleteOrderWithConfirmation(id, btn.getAttribute("data-label"));
      });
    });
  }

  function statusOptions(current) {
    var all = ["Em análise", "Em produção", "Pronto", "Entregue"];
    return all
      .map(function (s) {
        return '<option value="' + s + '"' + (s === current ? " selected" : "") + ">" + s + "</option>";
      })
      .join("");
  }

  function renderContacts(contacts) {
    var tbody = document.getElementById("adminContactsBody");
    setText("contactsCountLabel", contacts.length + (contacts.length === 1 ? " mensagem" : " mensagens"));
    tbody.innerHTML = "";
    if (!contacts.length) {
      tbody.innerHTML = '<tr><td colspan="5">Nenhuma mensagem encontrada.</td></tr>';
      return;
    }
    contacts.forEach(function (c) {
      var tr = document.createElement("tr");
      tr.innerHTML =
        "<td># " +
        c.id +
        "</td>" +
        "<td>" +
        escapeHtml(c.nome) +
        "</td>" +
        "<td>" +
        escapeHtml(c.email) +
        "</td>" +
        "<td>" +
        escapeHtml(c.mensagem) +
        "</td>" +
        "<td>" +
        new Date(c.createdAt).toLocaleString("pt-BR") +
        "</td>";
      tbody.appendChild(tr);
    });
  }

  function renderPrices(prices) {
    var tbody = document.getElementById("adminPricesBody");
    if (!tbody) return;
    tbody.innerHTML = "";
    if (!prices.length) {
      tbody.innerHTML = '<tr><td colspan="5">Nenhum preço cadastrado.</td></tr>';
      return;
    }
    prices.forEach(function (p) {
      var tr = document.createElement("tr");
      tr.innerHTML =
        "<td>" +
        escapeHtml(p.productName || "-") +
        "</td>" +
        "<td><code>" +
        escapeHtml(p.productKey || "-") +
        "</code></td>" +
        '<td><input class="admin-price-input" data-key="' +
        escapeHtml(p.productKey) +
        '" type="number" min="0" step="0.01" value="' +
        Number(p.basePrice || 0) +
        '" style="width:140px;padding:0.35rem 0.5rem;border-radius:8px;border:1px solid #dbeafe;font-family:inherit;" /></td>' +
        "<td>" +
        (p.updatedAt ? new Date(p.updatedAt).toLocaleString("pt-BR") : "-") +
        "</td>" +
        '<td><button class="btn btn-blue btn-small admin-save-price" data-key="' +
        escapeHtml(p.productKey) +
        '"><i class="fas fa-save"></i> Salvar</button></td>';
      tbody.appendChild(tr);
    });

    tbody.querySelectorAll(".admin-save-price").forEach(function (btn) {
      btn.addEventListener("click", async function () {
        var key = btn.getAttribute("data-key");
        var input = tbody.querySelector('.admin-price-input[data-key="' + CSS.escape(key) + '"]');
        var row = btn.closest("tr");
        var productName = row && row.cells && row.cells[0] ? row.cells[0].textContent.trim() : key;
        var value = input ? Number(input.value) : NaN;
        if (!Number.isFinite(value) || value < 0) {
          if (window.showToast) window.showToast("Preço inválido.", "error");
          return;
        }
        var result = await window.AdminAuth.updatePrice(key, value, productName);
        if (!result.ok) {
          if (window.showToast) window.showToast(result.message || "Erro ao atualizar preço.", "error");
          return;
        }
        localStorage.setItem("studioz_prices_updated_at", String(Date.now()));
        if (window.showToast) window.showToast("Preço atualizado com sucesso.", "success");
        loadAll();
      });
    });
  }

  async function openOrderModal(id) {
    var modalHost = document.getElementById("adminModal");
    if (!modalHost) return;
    var res = await window.AdminAuth.getOrder(id);
    if (!res.ok) {
      if (window.showToast) window.showToast(res.message || "Erro ao carregar pedido.", "error");
      return;
    }

    var o = res.order;
    var img =
      o.imageDataUrl ||
      "data:image/svg+xml," +
        encodeURIComponent(
          '<svg xmlns="http://www.w3.org/2000/svg" width="600" height="400"><rect fill="#e2e8f0" width="600" height="400"/><text x="50%" y="52%" text-anchor="middle" fill="#64748b" font-size="18">Sem imagem</text></svg>'
        );

    modalHost.innerHTML =
      '<div class="admin-modal-backdrop" id="adminModalBackdrop">' +
      '<div class="admin-modal">' +
      '<div class="admin-modal-head">' +
      "<h3 style=\"margin:0\">Pedido #" +
      escapeHtml(o.id) +
      "</h3>" +
      '<button class="btn btn-outline btn-small" id="adminModalClose"><i class="fas fa-xmark"></i></button>' +
      "</div>" +
      '<div class="admin-modal-body">' +
      '<div class="admin-modal-grid">' +
      '<div class="admin-modal-media">' +
      '<img src="' +
      img +
      '" alt="Arte do pedido" style="width:100%;border-radius:12px;border:1px solid #e2e8f0;object-fit:cover;max-height:320px;" />' +
      "</div>" +
      '<div class="admin-modal-info">' +
      '<p style="margin:0 0 0.5rem"><strong>Cliente:</strong> ' +
      escapeHtml(o.userName) +
      " • " +
      escapeHtml(o.userEmail) +
      "</p>" +
      '<p style="margin:0 0 0.5rem"><strong>Produto:</strong> ' +
      escapeHtml(o.productName) +
      ' <code style="margin-left:0.35rem">' +
      escapeHtml(o.productKey) +
      "</code></p>" +
      '<p style="margin:0 0 0.5rem"><strong>Medidas:</strong> ' +
      (o.diameter != null ? escapeHtml(o.diameter) : "-") +
      " cm (diâmetro) • " +
      (o.height != null ? escapeHtml(o.height) : "-") +
      " cm (altura)</p>" +
      '<p style="margin:0 0 0.5rem"><strong>Cor:</strong> <span style="display:inline-flex;align-items:center;gap:0.4rem"><span style="width:14px;height:14px;border-radius:4px;border:1px solid #cbd5e1;background:' +
      escapeHtml(o.color || "#ffffff") +
      '"></span>' +
      escapeHtml(o.color || "-") +
      "</span></p>" +
      '<p style="margin:0 0 0.5rem"><strong>Texto:</strong> ' +
      escapeHtml(o.text || "(sem texto)") +
      "</p>" +
      '<p style="margin:0 0 0.5rem"><strong>Fonte:</strong> ' +
      escapeHtml(o.font || "-") +
      " • <strong>Posição:</strong> " +
      escapeHtml(o.position || "-") +
      "</p>" +
      '<p style="margin:0 0 1rem"><strong>Criado em:</strong> ' +
      new Date(o.createdAt).toLocaleString("pt-BR") +
      "</p>" +
      '<div class="form-row">' +
      '<div class="form-group" style="margin:0">' +
      '<label for="adminEditPrice">Preço do pedido (R$)</label>' +
      '<input id="adminEditPrice" type="number" min="0" step="0.01" value="' +
      Number(o.price || 0) +
      '" />' +
      "</div>" +
      '<div class="form-group" style="margin:0">' +
      '<label for="adminEditStatus">Status</label>' +
      '<select id="adminEditStatus">' +
      statusOptions(o.status) +
      "</select>" +
      "</div>" +
      "</div>" +
      '<button class="btn btn-pink btn-block" id="adminSaveOrder"><i class="fas fa-floppy-disk"></i> Salvar alterações</button>' +
      '<button class="btn btn-danger btn-block" id="adminDeleteOrder"><i class="fas fa-trash"></i> Excluir pedido</button>' +
      "</div>" +
      "</div>" +
      "</div>" +
      "</div>" +
      "</div>";

    modalHost.style.display = "block";

    function close() {
      modalHost.style.display = "none";
      modalHost.innerHTML = "";
    }

    document.getElementById("adminModalClose").addEventListener("click", close);
    document.getElementById("adminModalBackdrop").addEventListener("click", function (e) {
      if (e.target && e.target.id === "adminModalBackdrop") close();
    });

    document.getElementById("adminSaveOrder").addEventListener("click", async function () {
      var price = Number(document.getElementById("adminEditPrice").value);
      var status = document.getElementById("adminEditStatus").value;
      if (!Number.isFinite(price) || price < 0) {
        if (window.showToast) window.showToast("Preço inválido.", "error");
        return;
      }
      var result = await window.AdminAuth.updateOrder(o.id, { price: price, status: status });
      if (!result.ok) {
        if (window.showToast) window.showToast(result.message || "Erro ao atualizar pedido.", "error");
        return;
      }
      if (window.showToast) window.showToast("Pedido atualizado.", "success");
      close();
      loadAll();
    });

    document.getElementById("adminDeleteOrder").addEventListener("click", async function () {
      var deleted = await deleteOrderWithConfirmation(o.id, "Pedido #" + o.id);
      if (deleted) close();
    });
  }

  async function deleteOrderWithConfirmation(id, label) {
    if (!id) return false;
    var name = label || "este pedido";
    var confirmed = window.confirm("Tem certeza que deseja excluir " + name + "? Essa ação não pode ser desfeita.");
    if (!confirmed) return false;

    var result = await window.AdminAuth.deleteOrder(id);
    if (!result.ok) {
      if (window.showToast) window.showToast(result.message || "Erro ao excluir pedido.", "error");
      return false;
    }
    if (window.showToast) window.showToast("Pedido excluído.", "success");
    loadAll();
    return true;
  }

  async function boot() {
    if (!window.AdminAuth || !window.AdminAuth.isLoggedIn()) {
      window.location.href = "admin-login.html";
      return;
    }

    var session = await window.AdminAuth.validateSession();
    if (!session.ok) {
      if (window.showToast) window.showToast(session.message || "Acesso administrativo expirado.", "error");
      window.location.href = "admin-login.html";
      return;
    }

    var admin = session.admin || window.AdminAuth.getUser();
    if (admin && admin.email) {
      document.getElementById("adminIdentity").textContent = admin.email + " • " + (admin.role || "Administrador");
    }

    document.getElementById("adminLogoutBtn").addEventListener("click", async function () {
      await window.AdminAuth.logout();
      window.location.href = "admin-login.html";
    });

    document.getElementById("reloadAdminBtn").addEventListener("click", function () {
      loadAll();
    });

    var quickRefresh = document.getElementById("quickRefreshBtn");
    if (quickRefresh) {
      quickRefresh.addEventListener("click", function () {
        loadAll();
      });
    }

    document.querySelectorAll(".admin-tab").forEach(function (btn) {
      btn.addEventListener("click", function () {
        setAdminTab(btn.getAttribute("data-admin-tab"));
      });
    });

    wireDashboardNavigation();
    loadAll();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
})();
