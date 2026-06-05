(function () {
  "use strict";

  function getSessionUser() {
    try {
      var raw = localStorage.getItem("studioz_session");
      return raw ? JSON.parse(raw) : null;
    } catch (e) {
      return null;
    }
  }

  window.getCurrentUser = function () {
    return getSessionUser();
  };

  window.setCurrentUser = function (user) {
    if (user) {
      localStorage.setItem("studioz_session", JSON.stringify(user));
    } else {
      localStorage.removeItem("studioz_session");
    }
  };

  // expose API base so other modules can call the same backend
  // Use an empty string by default so the frontend uses relative paths
  // (works when the static files are served from the same origin as the API).
  // Developers can still override at runtime with window.API_BASE_URL = 'http://host:port'
  window.API_BASE_URL = "";

  async function api(path, method, body) {
    var opts = { method: method || "GET", headers: {} };
    if (body) {
      opts.headers["Content-Type"] = "application/json";
      opts.body = JSON.stringify(body);
    }
    var res = await fetch(API_BASE_URL + path, opts);
    var data;
    try {
      data = await res.json();
    } catch (e) {
      data = { ok: false, message: "Erro de comunicação com o servidor." };
    }
    if (!res.ok) {
      return { ok: false, message: data.message || "Erro no servidor." };
    }
    return { ok: true, user: data };
  }

  window.registerUser = async function (name, email, password) {
    // Spring Boot backend expects 'username' field in RegisterRequest
    return api("/auth/register", "POST", {
      username: name.trim(),
      email: email.trim().toLowerCase(),
      password: password,
    });
  };

  window.loginUser = async function (email, password) {
    var result = await api("/auth/login", "POST", {
      email: email.trim().toLowerCase(),
      password: password,
    });
    if (result.ok && result.user) {
      window.setCurrentUser(result.user);
    }
    return result;
  };

  window.logoutUser = function () {
    window.setCurrentUser(null);
  };
})();
