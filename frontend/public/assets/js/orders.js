(function () {
  "use strict";

  async function api(path, method, body) {
    var opts = { method: method || "GET", headers: {} };
    if (body) {
      opts.headers["Content-Type"] = "application/json";
      opts.body = JSON.stringify(body);
    }
    var res;
    try {
      res = await fetch(path, opts);
    } catch (e) {
      return { ok: false, message: "Não foi possível conectar ao servidor. Verifique se o backend está rodando." };
    }

    var raw = "";
    try {
      raw = await res.text();
    } catch (e) {
      return { ok: false, message: "Erro ao ler a resposta do servidor." };
    }

    var data = {};
    if (raw) {
      try {
        data = JSON.parse(raw);
      } catch (e) {
        return { ok: false, message: "O servidor respondeu em um formato inválido." };
      }
    }
    if (!res.ok) return { ok: false, message: data.message || "Erro no servidor." };
    return data;
  }

  window.addOrder = async function (order) {
    var result = await api("/api/orders", "POST", order);
    return result;
  };

  window.getOrdersForUser = async function (email) {
    if (!email) return [];
    var result = await api("/api/orders?email=" + encodeURIComponent(email), "GET");
    if (!result.ok) return [];
    return result.orders || [];
  };

  window.updateOrderStatus = async function (orderId, status) {
    var result = await api("/api/orders/" + encodeURIComponent(orderId), "PATCH", { status: status });
    return !!result.ok;
  };
})();
