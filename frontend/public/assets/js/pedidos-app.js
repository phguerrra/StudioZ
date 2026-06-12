(function () {
  "use strict";

  function escapeHtml(s) {
    return String(s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function badgeClass(status) {
    if (status === "Em análise") return "status-analise";
    if (status === "Em produção") return "status-producao";
    if (status === "Pronto") return "status-pronto";
    if (status === "Entregue") return "status-entregue";
    return "status-analise";
  }

  async function render() {
    var container = document.getElementById("ordersContainer");
    if (!container) return;

    var user = window.getCurrentUser && window.getCurrentUser();
    if (!user) {
      container.innerHTML =
        '<div class="empty-state"><i class="fas fa-user-lock"></i><p>Faça login para ver seus pedidos.</p><p><a href="login.html" class="btn btn-blue" style="margin-top:1rem;display:inline-flex;">Entrar</a></p></div>';
      return;
    }

    var orders = await window.getOrdersForUser(user.email);
    if (orders.length === 0) {
      container.innerHTML =
        '<div class="empty-state"><i class="fas fa-box-open"></i><p>Você ainda não tem pedidos.</p><p><a href="personalizar.html" class="btn btn-pink" style="margin-top:1rem;display:inline-flex;">Personalizar agora</a></p></div>';
      return;
    }

    container.innerHTML = orders
      .map(function (o) {
        var thumb =
          o.imageDataUrl ||
          "data:image/svg+xml," +
            encodeURIComponent(
              '<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100"><rect fill="#e2e8f0" width="100" height="100"/><text x="50" y="55" text-anchor="middle" fill="#64748b" font-size="12">Sem img</text></svg>'
            );
        var textPreview = escapeHtml(o.text || "(sem texto)");
        return (
          '<article class="order-card" data-id="' +
          o.id +
          '">' +
          '<img class="order-thumb" src="' +
          thumb +
          '" alt="Arte do pedido" />' +
          '<div class="order-meta">' +
          "<h3>" +
          (o.productName || "Produto") +
          "</h3>" +
          "<p><strong>Texto:</strong> " +
          textPreview +
          "</p>" +
          "<p><strong>Valor:</strong> R$ " +
          (o.price != null ? Number(o.price).toFixed(2).replace(".", ",") : "—") +
          "</p>" +
          "<p><strong>Data:</strong> " +
          new Date(o.createdAt).toLocaleString("pt-BR") +
          "</p>" +
          "</div>" +
          '<div class="order-actions">' +
          '<span class="status-badge ' +
          badgeClass(o.status) +
          '"><i class="fas fa-circle-notch"></i> ' +
          o.status +
          "</span>" +
          "</div>" +
          "</article>"
        );
      })
      .join("");
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", render);
  } else {
    render();
  }
})();
