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
    if (!res.ok || data.ok === false) {
      return { ok: false, message: data.message || "Erro no servidor." };
    }
    return data;
  }

  window.registerUser = async function (name, email, password) {
    return api("/api/auth/register", "POST", {
      name: name.trim(),
      email: email.trim().toLowerCase(),
      password: password,
    });
  };

  window.loginUser = async function (email, password) {
    var result = await api("/api/auth/login", "POST", {
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
