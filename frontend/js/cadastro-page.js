(function () {
  "use strict";

  var form = document.getElementById("cadastroForm");
  if (!form) return;

  form.addEventListener("submit", async function (e) {
    e.preventDefault();
    var name = document.getElementById("name");
    var email = document.getElementById("email");
    var password = document.getElementById("password");
    var confirm = document.getElementById("confirmPassword");

    [name, email, password, confirm].forEach(function (el) {
      el.closest(".form-group").classList.remove("invalid");
    });

    var ok = true;
    if (!name.value.trim()) {
      name.closest(".form-group").classList.add("invalid");
      name.closest(".form-group").querySelector(".error-msg").textContent = "Informe seu nome.";
      ok = false;
    }
    if (!email.value.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.value)) {
      email.closest(".form-group").classList.add("invalid");
      email.closest(".form-group").querySelector(".error-msg").textContent = "E-mail inválido.";
      ok = false;
    }
    if (password.value.length < 6) {
      password.closest(".form-group").classList.add("invalid");
      password.closest(".form-group").querySelector(".error-msg").textContent = "Mínimo 6 caracteres.";
      ok = false;
    }
    if (password.value !== confirm.value) {
      confirm.closest(".form-group").classList.add("invalid");
      confirm.closest(".form-group").querySelector(".error-msg").textContent = "As senhas não coincidem.";
      ok = false;
    }
    if (!ok) return;

    var res = await window.registerUser(name.value, email.value, password.value);
    if (!res.ok) {
      if (window.showToast) window.showToast(res.message, "error");
      return;
    }
    await window.loginUser(email.value, password.value);
    if (window.showToast) window.showToast("Conta criada! Você já está logado.", "success");
    setTimeout(function () {
      window.location.href = "personalizar.html";
    }, 700);
  });
})();
