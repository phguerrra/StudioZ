(function () {
  "use strict";

  var TOKEN_KEY = "studioz_admin_token"; // kept for compatibility but not required by Spring backend
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
    // Spring Boot admin endpoints expect header 'X-User-Email'.
    // We store only the admin user in localStorage and keep TOKEN_KEY for compatibility.
    localStorage.setItem(TOKEN_KEY, token || "");
    localStorage.setItem(USER_KEY, JSON.stringify(user || {}));
  }

  function clearSession() {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
  }

  async function request(url, method, body) {
    var opts = { method: method || "GET", headers: {} };
    // attach admin identity as X-User-Email so Spring Boot AdminController can validate
    var admin = getUser();
    if (admin && admin.email) {
      opts.headers["X-User-Email"] = admin.email;
    }
    if (body) {
      opts.headers["Content-Type"] = "application/json";
      opts.body = JSON.stringify(body);
    }
    var base = (window.API_BASE_URL || "");
    var res = await fetch(base + url, opts);
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
      // Authenticate against the main auth endpoint and require ADMIN role
      var base = (window.API_BASE_URL || "");
      try {
        var res = await fetch(base + "/auth/login", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email: email, password: password }),
        });
        var payload = await res.json();
      } catch (err) {
        return { ok: false, message: "Falha de comunicação." };
      }

      // Spring Boot /auth/login returns a UserDTO directly (or may return a wrapper in some deployments).
      var user = null;
      if (payload) {
        if (payload.user) user = payload.user; // wrapper
        else if (payload.name || payload.email) user = payload; // direct DTO
      }
      if (!user) return { ok: false, message: payload.message || "Credenciais inválidas." };
      // normalize role string
      var role = (user.role || "").toString();
      if (role !== "ADMIN") {
        return { ok: false, message: "Acesso administrativo não autorizado." };
      }
      // store admin session (no token required by Spring endpoints; they use X-User-Email header)
      setSession("", user);
      return { ok: true, token: "", admin: user };
    },
    logout: function () {
      clearSession();
    },
    isLoggedIn: function () {
      return !!getToken();
    },
    getUser: getUser,
    getStats: async function () {
      var res = await request("/api/admin/stats", "GET");
      if (!res.ok) return res;
      // normalize older backend shapes that put stats at top-level
      if (!res.stats) {
        res.stats = {
          totalOrders: res.totalOrders || 0,
          totalRevenue: res.totalRevenue || 0,
          totalUsers: res.totalUsers || 0,
          totalContacts: res.totalContacts || 0,
          byStatus: res.byStatus || { "Em análise": res.pendingOrders || 0, "Em produção": 0, Pronto: res.completedOrders || 0, Entregue: 0 },
        };
      }
      return res;
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
