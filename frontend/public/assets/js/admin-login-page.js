(function () {
  "use strict";

  var form = document.getElementById("adminLoginForm");
  if (!form) return;

  if (window.AdminAuth && window.AdminAuth.isLoggedIn()) {
    window.AdminAuth.validateSession().then(function (session) {
      if (session.ok) window.location.href = "admin.html";
    });
  }

  form.addEventListener("submit", async function (e) {
    e.preventDefault();
    var email = document.getElementById("adminEmail");
    var password = document.getElementById("adminPassword");

    [email, password].forEach(function (el) {
      el.closest(".form-group").classList.remove("invalid");
    });

    var valid = true;
    if (!email.value.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.value)) {
      email.closest(".form-group").classList.add("invalid");
      valid = false;
    }
    if (!password.value) {
      password.closest(".form-group").classList.add("invalid");
      valid = false;
    }
    if (!valid) return;

    var result = await window.AdminAuth.login(email.value.trim().toLowerCase(), password.value);
    if (!result.ok) {
      if (window.showToast) window.showToast(result.message || "Erro no login admin.", "error");
      return;
    }

    var session = await window.AdminAuth.validateSession();
    if (!session.ok) {
      if (window.showToast) window.showToast(session.message || "Login aceito, mas a sessão admin não foi validada.", "error");
      return;
    }

    if (window.showToast) window.showToast("Login administrativo realizado.", "success");
    window.location.assign("admin.html");
  });
})();
