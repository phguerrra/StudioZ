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

  async function loadAll() {
    var statsRes = await window.AdminAuth.getStats();
    var ordersRes = await window.AdminAuth.getOrders();
    var contactsRes = await window.AdminAuth.getContacts();
    var pricesRes = await window.AdminAuth.getPrices();

    if (!statsRes.ok || !ordersRes.ok || !contactsRes.ok || !pricesRes.ok) {
      if (window.showToast) window.showToast("Falha ao carregar dashboard admin.", "error");
      return;
    }

    renderStats(statsRes.stats);
    renderOrders(ordersRes.orders || []);
    renderPrices(pricesRes.prices || []);
    renderContacts(contactsRes.contacts || []);
  }

  function renderStats(stats) {
    document.getElementById("kpiTotalOrders").textContent = String(stats.totalOrders || 0);
    document.getElementById("kpiRevenue").textContent = toCurrency(stats.totalRevenue || 0);
    document.getElementById("kpiUsers").textContent = String(stats.totalUsers || 0);
    document.getElementById("kpiContacts").textContent = String(stats.totalContacts || 0);
    document.getElementById("kpiAnalise").textContent = String(stats.byStatus["Em análise"] || 0);
    document.getElementById("kpiProducao").textContent = String(stats.byStatus["Em produção"] || 0);
    document.getElementById("kpiPronto").textContent = String(stats.byStatus["Pronto"] || 0);
    document.getElementById("kpiEntregue").textContent = String(stats.byStatus["Entregue"] || 0);
  }

  function renderOrders(orders) {
    var tbody = document.getElementById("adminOrdersBody");
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
        var value = input ? Number(input.value) : NaN;
        if (!Number.isFinite(value) || value < 0) {
          if (window.showToast) window.showToast("Preço inválido.", "error");
          return;
        }
        var result = await window.AdminAuth.updatePrice(key, value);
        if (!result.ok) {
          if (window.showToast) window.showToast(result.message || "Erro ao atualizar preço.", "error");
          return;
        }
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
  }

  function boot() {
    if (!window.AdminAuth || !window.AdminAuth.isLoggedIn()) {
      window.location.href = "admin-login.html";
      return;
    }

    var admin = window.AdminAuth.getUser();
    if (admin && admin.email) {
      document.getElementById("adminIdentity").textContent = admin.email + " • " + (admin.role || "Administrador");
    }

    document.getElementById("adminLogoutBtn").addEventListener("click", function () {
      window.AdminAuth.logout();
      window.location.href = "admin-login.html";
    });

    document.getElementById("reloadAdminBtn").addEventListener("click", function () {
      loadAll();
    });

    loadAll();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
})();
