(function () {
  "use strict";

  var TOKEN_KEY = "studioz_admin_token";
  var USER_KEY = "studioz_admin_user";
  var EXPIRES_KEY = "studioz_admin_expires_at";
  var FALLBACK_TTL_MS = 1000 * 60 * 60 * 8;

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

  function getExpiresAt() {
    return Number(localStorage.getItem(EXPIRES_KEY) || 0);
  }

  function setSession(token, user, expiresAt) {
    var expires = Number(expiresAt || 0) || Date.now() + FALLBACK_TTL_MS;
    localStorage.setItem(TOKEN_KEY, token || "");
    localStorage.setItem(USER_KEY, JSON.stringify(user || {}));
    localStorage.setItem(EXPIRES_KEY, String(expires));
    localStorage.removeItem("studioz_session");
  }

  function clearSession() {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    localStorage.removeItem(EXPIRES_KEY);
  }

  function hasLocalSession() {
    var token = getToken();
    var expiresAt = getExpiresAt();
    if (!token || !expiresAt || expiresAt <= Date.now()) {
      clearSession();
      return false;
    }
    return true;
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

    var res;
    try {
      res = await fetch(url, opts);
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
    if (!res.ok || data.ok === false) return { ok: false, message: data.message || "Erro na API." };
    return data;
  }

  window.AdminAuth = {
    login: async function (email, password) {
      var data = await request("/api/admin/login", "POST", {
        email: email,
        password: password,
      });
      if (data.ok && data.token) {
        setSession(data.token, data.admin || { email: email, role: "Administrador" }, data.expiresAt);
      }
      return data;
    },
    logout: async function () {
      if (hasLocalSession()) await request("/api/admin/logout", "POST");
      clearSession();
    },
    isLoggedIn: function () {
      return hasLocalSession();
    },
    validateSession: async function () {
      if (!hasLocalSession()) return { ok: false, message: "Sessão administrativa expirada." };
      var result = await request("/api/admin/session", "GET");
      if (!result.ok) clearSession();
      else if (result.expiresAt) setSession(getToken(), result.admin || getUser(), result.expiresAt);
      return result;
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
    deleteOrder: function (id) {
      return request("/api/admin/orders/" + encodeURIComponent(id), "DELETE");
    },
    getPrices: function () {
      return request("/api/admin/prices", "GET");
    },
    updatePrice: function (productKey, basePrice, productName) {
      return request("/api/admin/prices/" + encodeURIComponent(productKey), "PUT", { basePrice: basePrice, productName: productName });
    },
  };
})();
