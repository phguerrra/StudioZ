(function () {
  "use strict";

  var TOKEN_KEY = "studioz_admin_token";
  var USER_KEY = "studioz_admin_user";

  function getToken() {
    return localStorage.getItem(TOKEN_KEY) || "";
  }

  function getUser() {
    try {
      var raw = localStorage.getItem(USER_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch (e) {
      return null;
    }
  }

  function setSession(token, user) {
    localStorage.setItem(TOKEN_KEY, token || "");
    localStorage.setItem(USER_KEY, JSON.stringify(user || {}));
  }

  function clearSession() {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
  }

  async function request(url, method, body) {
    var opts = {
      method: method || "GET",
      headers: {},
    };
    var token = getToken();
    if (token) opts.headers["x-admin-token"] = token;
    if (body) {
      opts.headers["Content-Type"] = "application/json";
      opts.body = JSON.stringify(body);
    }

    var res = await fetch(url, opts);
    var data;
    try {
      data = await res.json();
    } catch (e) {
      data = { ok: false, message: "Falha de comunicação." };
    }
    if (!res.ok) return { ok: false, message: data.message || "Erro na API." };
    return data;
  }

  window.AdminAuth = {
    login: async function (email, password) {
      var data = await request("/api/admin/login", "POST", {
        email: email,
        password: password,
      });
      if (data.ok && data.token) {
        setSession(data.token, data.admin || { email: email, role: "Administrador" });
      }
      return data;
    },
    logout: function () {
      clearSession();
    },
    isLoggedIn: function () {
      return !!getToken();
    },
    getUser: getUser,
    getStats: function () {
      return request("/api/admin/stats", "GET");
    },
    getOrders: function () {
      return request("/api/admin/orders", "GET");
    },
    getOrder: function (id) {
      return request("/api/admin/orders/" + encodeURIComponent(id), "GET");
    },
    getContacts: function () {
      return request("/api/admin/contacts?limit=10", "GET");
    },
    updateOrderStatus: function (id, status) {
      return request("/api/admin/orders/" + encodeURIComponent(id) + "/status", "PATCH", { status: status });
    },
    updateOrder: function (id, patch) {
      return request("/api/admin/orders/" + encodeURIComponent(id), "PATCH", patch);
    },
    getPrices: function () {
      return request("/api/admin/prices", "GET");
    },
    updatePrice: function (productKey, basePrice) {
      return request("/api/admin/prices/" + encodeURIComponent(productKey), "PUT", { basePrice: basePrice });
    },
  };
})();
