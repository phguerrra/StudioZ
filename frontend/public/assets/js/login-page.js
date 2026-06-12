(function () {
  "use strict";

  var form = document.getElementById("loginForm");
  if (!form) return;

  function escapeHtml(s) {
    return String(s || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }

  function showLoggedInPrompt(user) {
    var firstName = user && user.name ? user.name.split(" ")[0] : "usuário";
    var modal = document.createElement("div");
    modal.className = "session-modal-backdrop";
    modal.setAttribute("role", "dialog");
    modal.setAttribute("aria-modal", "true");
    modal.innerHTML =
      '<div class="session-modal">' +
      '<div class="session-modal-icon"><i class="fas fa-user-check"></i></div>' +
      "<h2>Você já está logado</h2>" +
      "<p>Você está acessando como <strong>" +
      escapeHtml(firstName) +
      "</strong>. Para entrar com outra conta, é preciso sair primeiro.</p>" +
      '<div class="session-modal-actions">' +
      '<button type="button" class="btn btn-outline" id="keepSessionBtn"><i class="fas fa-arrow-left"></i> Continuar logado</button>' +
      '<button type="button" class="btn btn-blue" id="logoutForLoginBtn"><i class="fas fa-right-from-bracket"></i> Sair e entrar</button>' +
      "</div>" +
      "</div>";
    document.body.appendChild(modal);

    document.getElementById("keepSessionBtn").addEventListener("click", function () {
      window.location.href = "pedidos.html";
    });

    document.getElementById("logoutForLoginBtn").addEventListener("click", function () {
      window.logoutUser && window.logoutUser();
      modal.remove();
      form.reset();
      var email = document.getElementById("email");
      if (email) email.focus();
      if (window.showToast) window.showToast("Sessão encerrada. Entre com a conta desejada.", "success");
    });
  }

  var currentUser = window.getCurrentUser && window.getCurrentUser();
  if (currentUser) {
    showLoggedInPrompt(currentUser);
  }

  form.addEventListener("submit", async function (e) {
    e.preventDefault();
    var email = document.getElementById("email");
    var password = document.getElementById("password");
    [email, password].forEach(function (el) {
      el.closest(".form-group").classList.remove("invalid");
    });

    var ok = true;
    if (!email.value.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.value)) {
      email.closest(".form-group").classList.add("invalid");
      email.closest(".form-group").querySelector(".error-msg").textContent = "E-mail inválido.";
      ok = false;
    }
    if (!password.value) {
      password.closest(".form-group").classList.add("invalid");
      ok = false;
    }
    if (!ok) return;

    var res = await window.loginUser(email.value, password.value);
    if (!res.ok) {
      if (window.showToast) window.showToast(res.message, "error");
      return;
    }
    if (window.showToast) window.showToast("Bem-vindo de volta!", "success");
    setTimeout(function () {
      window.location.href = "pedidos.html";
    }, 600);
  });
})();
